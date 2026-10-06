import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import {
  Brackets,
  DataSource,
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Not,
} from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import {
  DEFAULT_PLAN_CODE,
  ENTITLEMENT_RELATIONS,
  activeCondition,
  entitlementsFor,
} from 'src/modules/plan/domain/entitlements';
import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { BillingCheckoutEntity } from '../domain/entities/billing-checkout.entity';
import { CouponEntity } from '../domain/entities/coupon.entity';
import {
  LedgerEntryEntity,
  type LedgerEntryType,
} from '../domain/entities/ledger-entry.entity';
import {
  type BillingCycle,
  SubscriptionEntity,
} from '../domain/entities/subscription.entity';
import { WebhookEventEntity } from '../domain/entities/webhook-event.entity';
import { priceFor, withCardFee } from '../domain/pricing';
import type { SubscribeDto } from './dto/billing.dto';
import { runIdempotent } from './idempotency';
import {
  type BillingEvent,
  type CardSubscriptionResult,
  PAYMENT_PROVIDER,
  PaymentDeclinedError,
  type PaymentDetails,
  type PaymentProvider,
} from './payment-provider';

/** Owed = CHARGE + REFUND - PAYMENT - CREDIT. */
const BALANCE_SIGN: Record<LedgerEntryType, 1 | -1> = {
  CHARGE: 1,
  REFUND: 1,
  PAYMENT: -1,
  CREDIT: -1,
};

export const MAX_INSTALLMENTS = 12;
const RENEWAL_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Back to the free plan, unless the company is already on another plan
 * (e.g. an admin moved it): only undo what this subscription granted.
 */
export async function downgrade(
  manager: EntityManager,
  subscription: SubscriptionEntity,
) {
  const freePlan = await manager
    .getRepository(PlanEntity)
    .findOneByOrFail({ code: DEFAULT_PLAN_CODE });
  await manager
    .getRepository(CompanyEntity)
    .update(
      { id: subscription.companyId, planId: subscription.planId },
      { planId: freePlan.id },
    );
}

/** Explicit end from the provider, else start (or now) + one billing cycle. */
function periodEnd(
  event: { currentPeriodEnd: string | null; periodStart?: string },
  cycle: BillingCycle,
) {
  if (event.currentPeriodEnd) {
    return new Date(event.currentPeriodEnd);
  }

  const end = event.periodStart
    ? new Date(`${event.periodStart.slice(0, 10)}T12:00:00Z`)
    : new Date();
  end.setUTCMonth(end.getUTCMonth() + (cycle === 'YEARLY' ? 12 : 1));
  return end;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

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
        installmentCount: subscription.installmentCount,
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

  /**
   * One history entry with what the payer needs to understand it: plan vs
   * card fee, installments, card and receipt (live from the gateway; the
   * entry still renders if the gateway is unreachable).
   */
  async ledgerEntry(auth: AuthPayload, entryId: string) {
    const entry = await this.dataSource
      .getRepository(LedgerEntryEntity)
      .findOneBy({ id: entryId, companyId: auth.companyId });

    if (!entry) {
      throw new AppException(ERROR_CODES.BILLING_ENTRY_NOT_FOUND);
    }

    const meta = (entry.metadata ?? {}) as {
      planId?: string;
      billingCycle?: BillingCycle;
      installmentCount?: number;
      feeCents?: number | null;
    };
    const plan = meta.planId
      ? await this.dataSource
          .getRepository(PlanEntity)
          .findOneBy({ id: meta.planId })
      : null;
    const installmentCount = meta.installmentCount ?? 1;
    let payment: PaymentDetails | null = null;

    if (
      this.provider &&
      entry.provider === this.provider.name &&
      entry.providerReference
    ) {
      payment = await this.provider
        .getPaymentDetails(entry.providerReference)
        .catch((error: unknown) => {
          this.logger.warn(
            `Payment details unavailable for ledger ${entry.id}: ${String(error)}`,
          );
          return null;
        });
    }

    return {
      id: entry.id,
      type: entry.type,
      description: entry.description,
      amountCents: entry.amountCents,
      currency: entry.currency,
      createdAt: entry.createdAt,
      plan: plan ? { code: plan.code, name: plan.name } : null,
      billingCycle: meta.billingCycle ?? null,
      installments:
        installmentCount > 1
          ? {
              count: installmentCount,
              amountCents: Math.floor(entry.amountCents / installmentCount),
            }
          : null,
      breakdown:
        meta.feeCents != null
          ? {
              planCents: entry.amountCents - meta.feeCents,
              feeCents: meta.feeCents,
            }
          : null,
      transactionId: entry.providerReference,
      payment,
    };
  }

  /**
   * Price per paid public plan and cycle with the gateway card fee passed to
   * the payer. `company` = its special conditions/coupons; null = catalog.
   */
  async quote(company: CompanyEntity | null) {
    const plans = await this.dataSource.getRepository(PlanEntity).find({
      where: { public: true, active: true },
      order: { sortOrder: 'ASC' },
    });
    const counts = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1);
    const fees = await Promise.all(counts.map((count) => this.cardFee(count)));
    const pricing = company ?? { plan: { id: '' }, conditions: [] };

    return {
      method: 'CREDIT_CARD' as const,
      quotes: plans.flatMap((plan) =>
        (['MONTHLY', 'YEARLY'] as const)
          .map((billingCycle) => {
            const base = priceFor(pricing as never, plan, billingCycle);

            return {
              planCode: plan.code,
              planName: plan.name,
              billingCycle,
              ...withCardFee(base, fees[0]),
              // Yearly can be split on the card; each count has its own fee tier.
              installments:
                billingCycle === 'YEARLY'
                  ? counts.map((count) => {
                      const { totalCents } = withCardFee(base, fees[count - 1]);

                      return {
                        count,
                        totalCents,
                        installmentCents: Math.floor(totalCents / count),
                      };
                    })
                  : [],
            };
          })
          .filter((quote) => quote.baseCents > 0),
      ),
    };
  }

  private cardFee(installmentCount: number) {
    return this.provider
      ? this.provider.cardFee(installmentCount)
      : Promise.resolve({ percent: 0, fixedCents: 0 });
  }

  async companyQuote(auth: AuthPayload) {
    return this.quote(await this.loadCompany(auth.companyId));
  }

  /**
   * Transparent checkout: charges the card now and activates the plan in the
   * same request. Idempotent per `Idempotency-Key` (keyed on plan/cycle/total,
   * never on card data).
   */
  subscribe(
    auth: AuthPayload,
    dto: SubscribeDto,
    remoteIp: string,
    idempotencyKey?: string,
  ) {
    this.assertOwner(auth);

    if (!idempotencyKey) {
      throw new AppException(ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
    }

    return runIdempotent(
      this.dataSource,
      `subscribe:${auth.companyId}`,
      idempotencyKey,
      {
        planCode: dto.planCode,
        billingCycle: dto.billingCycle,
        installmentCount: dto.installmentCount,
        expectedTotalCents: dto.expectedTotalCents,
      },
      () => this.createSubscription(auth, dto, remoteIp),
    );
  }

  private async createSubscription(
    auth: AuthPayload,
    dto: SubscribeDto,
    remoteIp: string,
  ) {
    const provider = this.requireProvider();
    const company = await this.loadCompany(auth.companyId);
    const current = await this.dataSource
      .getRepository(SubscriptionEntity)
      .findOneBy({ companyId: company.id, status: In(['ACTIVE', 'PAST_DUE']) });

    // A past-due installment plan has no live contract at the gateway (its
    // renewal was refused): paying again is how the owner recovers it.
    if (
      current &&
      !(current.status === 'PAST_DUE' && current.installmentCount > 1)
    ) {
      throw new AppException(ERROR_CODES.BILLING_ALREADY_SUBSCRIBED);
    }

    const plan = await this.dataSource.getRepository(PlanEntity).findOneBy({
      code: dto.planCode,
      active: true,
    });

    if (!plan || plan.code === DEFAULT_PLAN_CODE) {
      throw new AppException(ERROR_CODES.BILLING_PLAN_UNAVAILABLE);
    }

    const price = withCardFee(
      priceFor(company, plan, dto.billingCycle),
      await provider.cardFee(dto.installmentCount),
    );

    if (price.baseCents === 0) {
      throw new AppException(ERROR_CODES.BILLING_NOTHING_TO_PAY);
    }

    // The payer confirmed a total on screen: never charge a different one.
    if (price.totalCents !== dto.expectedTotalCents) {
      throw new AppException(ERROR_CODES.BILLING_QUOTE_CHANGED, {
        details: price,
      });
    }

    const checkouts = this.dataSource.getRepository(BillingCheckoutEntity);
    const checkout = await checkouts.save(
      checkouts.create({
        companyId: company.id,
        planId: plan.id,
        billingCycle: dto.billingCycle,
        amountCents: price.totalCents,
        feeCents: price.feeCents,
        installmentCount: dto.installmentCount,
        provider: provider.name,
        createdBy: auth.id,
      }),
    );
    let result: CardSubscriptionResult;

    try {
      result = await provider.subscribeWithCard({
        checkoutId: checkout.id,
        companyId: company.id,
        planName: plan.name,
        billingCycle: dto.billingCycle,
        amountCents: price.totalCents,
        installmentCount: dto.installmentCount,
        holder: dto.holder,
        card: dto.card,
        remoteIp,
      });
    } catch (error) {
      checkout.status = 'FAILED';
      await checkouts.save(checkout);

      if (error instanceof PaymentDeclinedError) {
        throw new AppException(ERROR_CODES.BILLING_PAYMENT_DECLINED, {
          message: error.message,
        });
      }

      throw new AppException(ERROR_CODES.BILLING_GATEWAY_ERROR, {
        cause: error,
      });
    }

    checkout.providerSessionId = result.providerSubscriptionId;
    checkout.providerCardToken = result.cardToken;
    await checkouts.save(checkout);

    // Same event (and inbox key) the gateway's webhook will send for this
    // charge, so whichever arrives second is a no-op.
    if (result.firstPayment.status === 'PAID') {
      await this.processEvent(provider.name, {
        type: 'INVOICE_PAID',
        externalEventId: `payment:${result.firstPayment.id}:paid`,
        providerSubscriptionId: result.providerSubscriptionId,
        providerCustomerId: result.providerCustomerId,
        invoiceId: result.firstPayment.id,
        amountCents: result.firstPayment.amountCents,
        currentPeriodEnd: null,
        periodStart: result.firstPayment.dueDate,
      });
    }

    return {
      checkoutId: checkout.id,
      status: result.firstPayment.status === 'PAID' ? 'ACTIVE' : 'PENDING',
      planCode: plan.code,
      amountCents: price.totalCents,
    };
  }

  /**
   * Stops renewals now; the plan stays until the paid period ends, when
   * BillingJobs downgrades. Installment plans have nothing live at the
   * gateway (the year is already charged): only the renewal is turned off.
   */
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

    if (subscription.installmentCount === 1) {
      await provider.cancelSubscription(subscription.providerSubscriptionId);
    }
    subscription.cancelAtPeriodEnd = true;
    await subscriptions.save(subscription);

    return {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  /** Hourly (BillingScheduler): ends paid periods, renews installment plans. */
  async runScheduledJobs(now = new Date()) {
    return {
      renewed: await this.renewInstallmentPlans(now),
      downgraded: await this.expireEndedPeriods(now),
    };
  }

  /**
   * Canceled subscriptions keep the plan until the paid period ends; a refused
   * installment renewal gets RENEWAL_GRACE_DAYS to be paid again.
   */
  private async expireEndedPeriods(now: Date) {
    const graceEnd = new Date(now.getTime() - RENEWAL_GRACE_DAYS * DAY_MS);
    const ended = await this.dataSource
      .getRepository(SubscriptionEntity)
      .createQueryBuilder('sub')
      // Still on the plan this subscription granted: not downgraded yet.
      .innerJoin(
        CompanyEntity,
        'company',
        'company.id = sub.companyId AND company.planId = sub.planId',
      )
      .where('sub.currentPeriodEnd <= :now', { now })
      .andWhere(
        new Brackets((qb) =>
          qb
            .where("sub.status = 'CANCELED'")
            .orWhere('sub.cancelAtPeriodEnd = true')
            .orWhere(
              "sub.status = 'PAST_DUE' AND sub.installmentCount > 1 AND sub.currentPeriodEnd <= :graceEnd",
              { graceEnd },
            ),
        ),
      )
      .getMany();

    for (const subscription of ended) {
      await this.dataSource.transaction(async (manager) => {
        await manager
          .getRepository(SubscriptionEntity)
          .update({ id: subscription.id }, { status: 'CANCELED' });
        await downgrade(manager, subscription);
      });
    }

    return ended.length;
  }

  /**
   * Installment plans have no recurring contract at the gateway: at the end
   * of each year we charge the same total and split with the stored card
   * token. Refused → PAST_DUE (plan kept for the grace period).
   */
  private async renewInstallmentPlans(now: Date) {
    const provider = this.provider;
    if (!provider) return 0;

    const due = await this.dataSource.getRepository(SubscriptionEntity).find({
      where: {
        provider: provider.name,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        installmentCount: MoreThan(1),
        currentPeriodEnd: LessThanOrEqual(now),
        providerCardToken: Not(IsNull()),
        providerCustomerId: Not(IsNull()),
      },
      relations: { plan: true },
    });
    const checkouts = this.dataSource.getRepository(BillingCheckoutEntity);
    let renewed = 0;

    for (const subscription of due) {
      const periodStart = subscription.currentPeriodEnd!.toISOString();
      const checkout = await checkouts.save(
        checkouts.create({
          companyId: subscription.companyId,
          planId: subscription.planId,
          billingCycle: subscription.billingCycle,
          amountCents: subscription.amountCents,
          feeCents: subscription.feeCents,
          installmentCount: subscription.installmentCount,
          provider: provider.name,
          createdBy: null,
        }),
      );

      try {
        const charge = await provider.chargeCardToken({
          providerCustomerId: subscription.providerCustomerId!,
          cardToken: subscription.providerCardToken!,
          amountCents: subscription.amountCents,
          installmentCount: subscription.installmentCount,
          description: `LinkBuds ${subscription.plan.name} (anual, renovação)`,
          // One charge per subscription and period, even across retries.
          reference: `renewal:${subscription.id}:${periodStart.slice(0, 10)}`,
        });
        checkout.providerSessionId = charge.providerChargeId;
        await checkouts.save(checkout);
        await this.processEvent(provider.name, {
          type: 'INVOICE_PAID',
          externalEventId: `payment:${charge.firstPaymentId}:paid`,
          providerSubscriptionId: charge.providerChargeId,
          invoiceId: charge.firstPaymentId,
          amountCents: subscription.amountCents,
          currentPeriodEnd: null,
          // The new year starts where the paid one ended, not when the job ran.
          periodStart,
        });
        renewed += 1;
      } catch (error) {
        checkout.status = 'FAILED';
        await checkouts.save(checkout);

        if (error instanceof PaymentDeclinedError) {
          await this.dataSource
            .getRepository(SubscriptionEntity)
            .update({ id: subscription.id }, { status: 'PAST_DUE' });
        } else {
          // Gateway/infra error: next run retries; `reference` prevents a 2nd charge.
          this.logger.error(
            `Renewal of subscription ${subscription.id} failed`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }

    return renewed;
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
    let event: BillingEvent | null;

    try {
      if (providerName !== provider.name || !rawBody)
        throw new Error('mismatch');
      event = provider.parseWebhook(rawBody, headers);
    } catch {
      throw new AppException(ERROR_CODES.BILLING_WEBHOOK_INVALID);
    }

    if (!event) {
      return { received: true, ignored: true };
    }

    return this.processEvent(provider.name, event);
  }

  /** Inbox + apply in one transaction; shared by webhooks and API responses. */
  private async processEvent(providerName: string, event: BillingEvent) {
    const inbox = this.dataSource.getRepository(WebhookEventEntity);
    await inbox
      .createQueryBuilder()
      .insert()
      .values({
        provider: providerName,
        externalEventId: event.externalEventId,
        type: event.type,
        payload: event as never,
      })
      .orIgnore()
      .execute();
    const stored = await inbox.findOneByOrFail({
      provider: providerName,
      externalEventId: event.externalEventId,
    });

    if (stored.processedAt) {
      return { received: true, duplicate: true };
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.applyEvent(manager, providerName, event);
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
    /** Per gateway invoice, so failed-then-paid charges the invoice once. */
    const key = (reference: string, suffix: string) =>
      `${provider}:${reference}:${suffix}`;
    // Providers only emit events for what we created; an unknown subscription
    // means the API response is still being saved: throw so the gateway retries.
    // Installment plans get a new gateway id each renewal: older ids are
    // found through the checkout that created them.
    const findSubscription = async (providerSubscriptionId: string) => {
      const direct = await subscriptions.findOneBy({
        provider,
        providerSubscriptionId,
      });
      if (direct) return direct;

      const checkout = await manager
        .getRepository(BillingCheckoutEntity)
        .findOneByOrFail({
          provider,
          providerSessionId: providerSubscriptionId,
        });

      return subscriptions.findOneByOrFail({ companyId: checkout.companyId });
    };

    switch (event.type) {
      case 'INVOICE_PAID': {
        const known = await subscriptions.findOneBy({
          provider,
          providerSubscriptionId: event.providerSubscriptionId,
        });
        // A new contract (first purchase or installment renewal) is charged
        // as one total: the checkout knows it, a single parcel does not.
        const activated = known
          ? null
          : await this.activateCheckout(manager, provider, event);
        const subscription = known ?? activated!.subscription;
        subscription.status = 'ACTIVE';
        subscription.currentPeriodEnd = periodEnd(
          event,
          subscription.billingCycle,
        );
        await subscriptions.save(subscription);
        await this.recordPayment(
          manager,
          subscription,
          activated?.amountCents ?? event.amountCents,
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
          idempotencyKey: key(event.invoiceId, 'charge'),
        });
        return;
      }
      case 'SUBSCRIPTION_CANCELED': {
        const subscription = await findSubscription(
          event.providerSubscriptionId,
        );
        subscription.status = 'CANCELED';
        subscription.cancelAtPeriodEnd = true;
        await subscriptions.save(subscription);
        // Paid time is kept: BillingJobs downgrades when the period ends.
        if (
          !subscription.currentPeriodEnd ||
          subscription.currentPeriodEnd <= new Date()
        ) {
          await downgrade(manager, subscription);
        }
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
          idempotencyKey: key(event.refundId, 'refund'),
        });
        return;
      }
    }
  }

  /** First paid charge of a checkout: the company switches to its plan. */
  private async activateCheckout(
    manager: EntityManager,
    provider: string,
    event: Extract<BillingEvent, { type: 'INVOICE_PAID' }>,
  ) {
    const checkouts = manager.getRepository(BillingCheckoutEntity);
    const subscriptions = manager.getRepository(SubscriptionEntity);
    const checkout = await checkouts.findOneByOrFail({
      provider,
      providerSessionId: event.providerSubscriptionId,
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
        amountCents: checkout.amountCents,
        feeCents: checkout.feeCents,
        installmentCount: checkout.installmentCount,
        provider,
        providerCustomerId:
          event.providerCustomerId ?? existing?.providerCustomerId ?? null,
        providerSubscriptionId: event.providerSubscriptionId,
        providerCardToken:
          checkout.providerCardToken ?? existing?.providerCardToken ?? null,
        cancelAtPeriodEnd: false,
      }),
    );
    checkout.status = 'COMPLETED';
    await checkouts.save(checkout);
    await manager
      .getRepository(CompanyEntity)
      .update({ id: checkout.companyId }, { planId: checkout.planId });

    return { subscription, amountCents: checkout.amountCents };
  }

  private async recordPayment(
    manager: EntityManager,
    subscription: SubscriptionEntity,
    amountCents: number,
    provider: string,
    reference: string,
  ) {
    if (amountCents <= 0) {
      return;
    }

    // Breakdown as charged, frozen in the entry (subscriptions change later).
    const feeCents =
      amountCents === subscription.amountCents ? subscription.feeCents : null;
    const base = {
      companyId: subscription.companyId,
      subscriptionId: subscription.id,
      amountCents,
      provider,
      providerReference: reference,
      metadata: {
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        installmentCount: subscription.installmentCount,
        feeCents,
      },
    };
    await this.appendLedger(manager, {
      ...base,
      type: 'CHARGE',
      description: `Assinatura (${subscription.billingCycle === 'YEARLY' ? 'anual' : 'mensal'})`,
      idempotencyKey: `${provider}:${reference}:charge`,
    });
    await this.appendLedger(manager, {
      ...base,
      type: 'PAYMENT',
      description: 'Pagamento recebido',
      idempotencyKey: `${provider}:${reference}:payment`,
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
    > &
      Partial<Pick<LedgerEntryEntity, 'metadata'>>,
  ) {
    await manager
      .getRepository(LedgerEntryEntity)
      .createQueryBuilder()
      .insert()
      // jsonb column: TypeORM's deep-partial typing can't express it.
      .values(entry as never)
      .orIgnore()
      .execute();
  }
}
