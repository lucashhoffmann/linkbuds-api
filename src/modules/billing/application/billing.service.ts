import { Inject, Injectable, Optional } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { DataSource, EntityManager, In } from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import {
  DEFAULT_PLAN_CODE,
  ENTITLEMENT_RELATIONS,
  activeCondition,
  entitlementsFor,
} from 'src/modules/plan/domain/entitlements';
import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { AuthUserEntity } from 'src/modules/auth/domain/entities/auth-user.entity';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { BillingCheckoutEntity } from '../domain/entities/billing-checkout.entity';
import { CouponEntity } from '../domain/entities/coupon.entity';
import {
  LedgerEntryEntity,
  type LedgerEntryType,
} from '../domain/entities/ledger-entry.entity';
import { SubscriptionEntity } from '../domain/entities/subscription.entity';
import { WebhookEventEntity } from '../domain/entities/webhook-event.entity';
import { priceFor } from '../domain/pricing';
import {
  FakePaymentProvider,
  FAKE_SIGNATURE_HEADER,
  signFakePayload,
} from '../infra/fake-payment.provider';
import type { CheckoutDto } from './dto/billing.dto';
import { runIdempotent } from './idempotency';
import {
  type BillingEvent,
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './payment-provider';

/** Owed = CHARGE + REFUND - PAYMENT - CREDIT. */
const BALANCE_SIGN: Record<LedgerEntryType, 1 | -1> = {
  CHARGE: 1,
  REFUND: 1,
  PAYMENT: -1,
  CREDIT: -1,
};

function webBaseUrl() {
  return (process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173').replace(
    /\/$/,
    '',
  );
}

@Injectable()
export class BillingService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProvider | null,
  ) {}

  private assertOwner(auth: AuthPayload) {
    if (auth.role !== UserRole.OWNER) {
      throw new AppException(ERROR_CODES.BILLING_OWNER_REQUIRED);
    }
  }

  private requireProvider(): PaymentProvider {
    if (!this.provider) {
      throw new AppException(ERROR_CODES.BILLING_NOT_CONFIGURED);
    }

    return this.provider;
  }

  private loadCompany(
    companyId: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    return manager.getRepository(CompanyEntity).findOneOrFail({
      where: { id: companyId },
      relations: ENTITLEMENT_RELATIONS,
    });
  }

  async overview(auth: AuthPayload) {
    const company = await this.loadCompany(auth.companyId);
    const [subscription, plans, ledger] = await Promise.all([
      this.dataSource.getRepository(SubscriptionEntity).findOne({
        where: { companyId: auth.companyId },
        relations: { plan: true },
      }),
      this.dataSource.getRepository(PlanEntity).find({
        where: { public: true, active: true },
        order: { sortOrder: 'ASC' },
      }),
      this.dataSource.getRepository(LedgerEntryEntity).find({
        where: { companyId: auth.companyId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    ]);
    const condition = activeCondition(company.conditions);
    const coupon = condition?.couponId
      ? await this.dataSource
          .getRepository(CouponEntity)
          .findOneBy({ id: condition.couponId })
      : null;

    return {
      providerConfigured: Boolean(this.provider),
      provider: this.provider?.name ?? null,
      plan: { code: company.plan.code, name: company.plan.name },
      entitlements: entitlementsFor(company),
      specialCondition: condition
        ? {
            note: condition.note,
            endsAt: condition.endsAt,
            coupon: coupon?.code ?? null,
          }
        : null,
      subscription: subscription && {
        status: subscription.status,
        plan: { code: subscription.plan.code, name: subscription.plan.name },
        billingCycle: subscription.billingCycle,
        amountCents: subscription.amountCents,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      prices: plans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        monthlyCents: priceFor(company, plan, 'MONTHLY'),
        yearlyCents: priceFor(company, plan, 'YEARLY'),
      })),
      balanceCents: ledger.reduce(
        (sum, entry) => sum + BALANCE_SIGN[entry.type] * entry.amountCents,
        0,
      ),
      ledger: ledger.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amountCents: entry.amountCents,
        currency: entry.currency,
        description: entry.description,
        createdAt: entry.createdAt,
      })),
    };
  }

  /** Idempotent per `Idempotency-Key`: retries return the same checkout. */
  checkout(auth: AuthPayload, dto: CheckoutDto, idempotencyKey?: string) {
    this.assertOwner(auth);

    if (!idempotencyKey) {
      throw new AppException(ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
    }

    return runIdempotent(
      this.dataSource,
      `checkout:${auth.companyId}`,
      idempotencyKey,
      dto,
      () => this.createCheckout(auth, dto, idempotencyKey),
    );
  }

  private async createCheckout(
    auth: AuthPayload,
    dto: CheckoutDto,
    idempotencyKey: string,
  ) {
    const provider = this.requireProvider();
    const company = await this.loadCompany(auth.companyId);
    const plan = await this.dataSource.getRepository(PlanEntity).findOneBy({
      code: dto.planCode,
      active: true,
    });

    if (!plan || plan.code === DEFAULT_PLAN_CODE) {
      throw new AppException(ERROR_CODES.BILLING_PLAN_UNAVAILABLE);
    }

    const amountCents = priceFor(company, plan, dto.billingCycle);

    if (amountCents === 0) {
      throw new AppException(ERROR_CODES.BILLING_NOTHING_TO_PAY);
    }

    const checkouts = this.dataSource.getRepository(BillingCheckoutEntity);
    const checkout = await checkouts.save(
      checkouts.create({
        companyId: company.id,
        planId: plan.id,
        billingCycle: dto.billingCycle,
        amountCents,
        provider: provider.name,
        createdBy: auth.id,
      }),
    );
    const owner = await this.dataSource
      .getRepository(AuthUserEntity)
      .findOneBy({ id: auth.id });
    const session = await provider.createCheckout({
      checkoutId: checkout.id,
      companyId: company.id,
      customerEmail: owner?.email ?? company.email,
      planCode: plan.code,
      planName: plan.name,
      billingCycle: dto.billingCycle,
      amountCents,
      successUrl: `${webBaseUrl()}/settings`,
      cancelUrl: `${webBaseUrl()}/settings`,
      idempotencyKey,
    });
    checkout.providerSessionId = session.providerSessionId;
    checkout.checkoutUrl = session.checkoutUrl;
    await checkouts.save(checkout);

    return {
      checkoutId: checkout.id,
      checkoutUrl: session.checkoutUrl,
      amountCents,
    };
  }

  /** Cancels at period end; the provider's SUBSCRIPTION_CANCELED downgrades. */
  async cancel(auth: AuthPayload) {
    this.assertOwner(auth);
    const provider = this.requireProvider();
    const subscriptions = this.dataSource.getRepository(SubscriptionEntity);
    const subscription = await subscriptions.findOneBy({
      companyId: auth.companyId,
      status: In(['ACTIVE', 'PAST_DUE']),
    });

    if (!subscription?.providerSubscriptionId) {
      throw new AppException(ERROR_CODES.BILLING_NO_SUBSCRIPTION);
    }

    await provider.cancelSubscription(subscription.providerSubscriptionId);
    subscription.cancelAtPeriodEnd = true;
    await subscriptions.save(subscription);

    return {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  /**
   * Webhook inbox: store first (dedupe by provider event id), then process
   * in one transaction. Failures stay recorded and the provider retries.
   */
  async handleWebhook(
    providerName: string,
    rawBody: Buffer | undefined,
    headers: IncomingHttpHeaders,
  ) {
    const provider = this.requireProvider();
    let event: BillingEvent;

    try {
      if (providerName !== provider.name || !rawBody)
        throw new Error('mismatch');
      event = provider.parseWebhook(rawBody, headers);
    } catch {
      throw new AppException(ERROR_CODES.BILLING_WEBHOOK_INVALID);
    }

    const inbox = this.dataSource.getRepository(WebhookEventEntity);
    await inbox
      .createQueryBuilder()
      .insert()
      .values({
        provider: provider.name,
        externalEventId: event.externalEventId,
        type: event.type,
        payload: event as never,
      })
      .orIgnore()
      .execute();
    const stored = await inbox.findOneByOrFail({
      provider: provider.name,
      externalEventId: event.externalEventId,
    });

    if (stored.processedAt) {
      return { received: true, duplicate: true };
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.applyEvent(manager, provider.name, event);
        await manager
          .getRepository(WebhookEventEntity)
          .update({ id: stored.id }, { processedAt: new Date(), error: null });
      });
    } catch (error) {
      await inbox.update(
        { id: stored.id },
        { error: error instanceof Error ? error.message : String(error) },
      );
      throw error;
    }

    return { received: true, duplicate: false };
  }

  private async applyEvent(
    manager: EntityManager,
    provider: string,
    event: BillingEvent,
  ) {
    const subscriptions = manager.getRepository(SubscriptionEntity);
    const key = (suffix: string) =>
      `${provider}:${event.externalEventId}:${suffix}`;
    const findSubscription = async (providerSubscriptionId: string) =>
      subscriptions.findOneByOrFail({ providerSubscriptionId });

    switch (event.type) {
      case 'CHECKOUT_COMPLETED': {
        const checkouts = manager.getRepository(BillingCheckoutEntity);
        const checkout = await checkouts.findOneByOrFail({
          providerSessionId: event.providerSessionId,
        });
        const existing = await subscriptions.findOneBy({
          companyId: checkout.companyId,
        });
        const subscription = await subscriptions.save(
          subscriptions.merge(existing ?? subscriptions.create(), {
            companyId: checkout.companyId,
            planId: checkout.planId,
            status: 'ACTIVE',
            billingCycle: checkout.billingCycle,
            amountCents: event.amountCents,
            provider,
            providerCustomerId: event.providerCustomerId,
            providerSubscriptionId: event.providerSubscriptionId,
            currentPeriodEnd: new Date(event.currentPeriodEnd),
            cancelAtPeriodEnd: false,
          }),
        );
        checkout.status = 'COMPLETED';
        await checkouts.save(checkout);
        await manager
          .getRepository(CompanyEntity)
          .update({ id: checkout.companyId }, { planId: checkout.planId });
        await this.recordPayment(
          manager,
          subscription,
          event.amountCents,
          key,
          provider,
          event.providerSessionId,
        );
        return;
      }
      case 'INVOICE_PAID': {
        const subscription = await findSubscription(
          event.providerSubscriptionId,
        );
        subscription.status = 'ACTIVE';
        subscription.currentPeriodEnd = new Date(event.currentPeriodEnd);
        await subscriptions.save(subscription);
        await this.recordPayment(
          manager,
          subscription,
          event.amountCents,
          key,
          provider,
          event.invoiceId,
        );
        return;
      }
      case 'PAYMENT_FAILED': {
        const subscription = await findSubscription(
          event.providerSubscriptionId,
        );
        subscription.status = 'PAST_DUE';
        await subscriptions.save(subscription);
        await this.appendLedger(manager, {
          companyId: subscription.companyId,
          subscriptionId: subscription.id,
          type: 'CHARGE',
          amountCents: event.amountCents,
          description: 'Cobrança da assinatura (pagamento falhou)',
          provider,
          providerReference: event.invoiceId,
          idempotencyKey: key('charge'),
        });
        return;
      }
      case 'SUBSCRIPTION_CANCELED': {
        const subscription = await findSubscription(
          event.providerSubscriptionId,
        );
        subscription.status = 'CANCELED';
        await subscriptions.save(subscription);
        const freePlan = await manager
          .getRepository(PlanEntity)
          .findOneByOrFail({ code: DEFAULT_PLAN_CODE });
        await manager
          .getRepository(CompanyEntity)
          .update({ id: subscription.companyId }, { planId: freePlan.id });
        return;
      }
      case 'REFUNDED': {
        const subscription = await findSubscription(
          event.providerSubscriptionId,
        );
        await this.appendLedger(manager, {
          companyId: subscription.companyId,
          subscriptionId: subscription.id,
          type: 'REFUND',
          amountCents: event.amountCents,
          description: 'Estorno',
          provider,
          providerReference: event.refundId,
          idempotencyKey: key('refund'),
        });
        return;
      }
    }
  }

  private async recordPayment(
    manager: EntityManager,
    subscription: SubscriptionEntity,
    amountCents: number,
    key: (suffix: string) => string,
    provider: string,
    reference: string,
  ) {
    if (amountCents <= 0) {
      return;
    }

    const base = {
      companyId: subscription.companyId,
      subscriptionId: subscription.id,
      amountCents,
      provider,
      providerReference: reference,
    };
    await this.appendLedger(manager, {
      ...base,
      type: 'CHARGE',
      description: `Assinatura (${subscription.billingCycle === 'YEARLY' ? 'anual' : 'mensal'})`,
      idempotencyKey: key('charge'),
    });
    await this.appendLedger(manager, {
      ...base,
      type: 'PAYMENT',
      description: 'Pagamento recebido',
      idempotencyKey: key('payment'),
    });
  }

  /** Insert-only; a repeated idempotency key is a no-op. */
  private async appendLedger(
    manager: EntityManager,
    entry: Pick<
      LedgerEntryEntity,
      | 'companyId'
      | 'subscriptionId'
      | 'type'
      | 'amountCents'
      | 'description'
      | 'provider'
      | 'providerReference'
      | 'idempotencyKey'
    >,
  ) {
    await manager
      .getRepository(LedgerEntryEntity)
      .createQueryBuilder()
      .insert()
      .values(entry)
      .orIgnore()
      .execute();
  }

  /**
   * Dev only (BILLING_PROVIDER=fake): simulates the gateway approving a
   * checkout by sending a signed webhook through the real pipeline.
   */
  async completeFakeCheckout(auth: AuthPayload, providerSessionId: string) {
    this.assertOwner(auth);
    const provider = this.requireProvider();

    if (!(provider instanceof FakePaymentProvider)) {
      throw new AppException(ERROR_CODES.BILLING_CHECKOUT_NOT_FOUND);
    }

    const checkout = await this.dataSource
      .getRepository(BillingCheckoutEntity)
      .findOneBy({ providerSessionId, companyId: auth.companyId });

    if (!checkout) {
      throw new AppException(ERROR_CODES.BILLING_CHECKOUT_NOT_FOUND);
    }

    const periodEnd = new Date();
    periodEnd.setMonth(
      periodEnd.getMonth() + (checkout.billingCycle === 'YEARLY' ? 12 : 1),
    );
    const event: BillingEvent = {
      type: 'CHECKOUT_COMPLETED',
      externalEventId: `fake_evt_${checkout.id}`,
      providerSessionId,
      providerCustomerId: `fake_cus_${checkout.companyId}`,
      providerSubscriptionId: `fake_sub_${checkout.companyId}`,
      amountCents: checkout.amountCents,
      currentPeriodEnd: periodEnd.toISOString(),
    };
    const body = JSON.stringify(event);

    return this.handleWebhook(provider.name, Buffer.from(body), {
      [FAKE_SIGNATURE_HEADER]: signFakePayload(body),
    });
  }
}
