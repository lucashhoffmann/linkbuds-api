import { timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import {
  type BillingEvent,
  type CardFee,
  type CardSubscriptionRequest,
  type CardSubscriptionResult,
  PaymentDeclinedError,
  type PaymentDetails,
  type PaymentProvider,
  type TokenChargeRequest,
  type TokenChargeResult,
} from '../application/payment-provider';

export const ASAAS_TOKEN_HEADER = 'asaas-access-token';
/** Tags everything we create, so events of other apps on the account are ignored. */
export const ASAAS_REFERENCE_PREFIX = 'linkbuds:';
const FEE_TTL_MS = 60 * 60 * 1000;

interface AsaasPayment {
  id: string;
  status?: string;
  subscription?: string | null;
  /** Installment plan id; installmentNumber 1 is the first charge. */
  installment?: string | null;
  installmentNumber?: number | null;
  customer?: string | null;
  externalReference?: string | null;
  value: number;
  dueDate: string;
}

export interface AsaasWebhook {
  id: string;
  event: string;
  payment?: AsaasPayment;
  subscription?: { id: string; externalReference?: string | null };
}

interface AsaasCardFees {
  operationValue: number;
  oneInstallmentPercentage: number;
  upToSixInstallmentsPercentage: number;
  upToTwelveInstallmentsPercentage: number;
  discountOneInstallmentPercentage?: number;
  discountUpToSixInstallmentsPercentage?: number;
  discountUpToTwelveInstallmentsPercentage?: number;
  hasValidDiscount?: boolean;
}

interface AsaasCardCharge {
  id: string;
  status?: string;
  value: number;
  dueDate: string;
  installment?: string | null;
  creditCard?: { creditCardToken?: string | null } | null;
}

/** Asaas card fee tiers: 1x, 2–6x, 7–12x (discounted while a promo is valid). */
export function asaasCardFee(fees: AsaasCardFees, installmentCount: number) {
  const tier =
    installmentCount <= 1
      ? ([
          'oneInstallmentPercentage',
          'discountOneInstallmentPercentage',
        ] as const)
      : installmentCount <= 6
        ? ([
            'upToSixInstallmentsPercentage',
            'discountUpToSixInstallmentsPercentage',
          ] as const)
        : ([
            'upToTwelveInstallmentsPercentage',
            'discountUpToTwelveInstallmentsPercentage',
          ] as const);
  const discounted = fees.hasValidDiscount ? fees[tier[1]] : undefined;

  return {
    percent: discounted ?? fees[tier[0]],
    fixedCents: Math.round(fees.operationValue * 100),
  };
}

const toCents = (value: number) => Math.round(value * 100);
/** "MASTERCARD" → "Mastercard" (AMEX stays an acronym). */
const brandLabel = (brand: string) =>
  brand === 'AMEX' ? 'Amex' : brand.charAt(0) + brand.slice(1).toLowerCase();
const paid = (status?: string) =>
  status === 'CONFIRMED' || status === 'RECEIVED';
const ours = (reference?: string | null) =>
  Boolean(reference?.startsWith(ASAAS_REFERENCE_PREFIX));

/** Today in Brazil (Asaas dates are BRT), as "YYYY-MM-DD". */
const todayInBrazil = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/**
 * Asaas, transparent checkout: our page collects the card, the API creates
 * the subscription with it and captures the first charge right away.
 * Setup: docs/monetizacao.md.
 */
export class AsaasPaymentProvider implements PaymentProvider {
  readonly name = 'asaas';
  private fees: { value: AsaasCardFees; expiresAt: number } | null = null;

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly webhookToken: string,
  ) {}

  static fromEnv() {
    const apiUrl = process.env.ASAAS_API_URL?.trim().replace(/\/$/, '');
    const apiKey = process.env.ASAAS_API_KEY?.trim();
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();

    if (!apiUrl || !apiKey || !webhookToken || webhookToken.length < 32) {
      throw new Error(
        'BILLING_PROVIDER=asaas requires ASAAS_API_URL, ASAAS_API_KEY and ASAAS_WEBHOOK_TOKEN (32+ chars)',
      );
    }

    return new AsaasPaymentProvider(apiUrl, apiKey, webhookToken);
  }

  /** 400 with a message = payer-facing refusal (bad card/CPF); anything else is ours. */
  private async request<T>(method: string, path: string, body?: unknown) {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        access_token: this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'LinkBuds/1.0',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Asaas asks for 60s: card capture can be slow; a short timeout invites double charges.
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();

    if (response.status === 400) {
      let message: string | undefined;

      try {
        message = (
          JSON.parse(text) as { errors?: Array<{ description?: string }> }
        ).errors?.[0]?.description;
      } catch {
        // not JSON: falls through to the generic error
      }

      if (message) {
        throw new PaymentDeclinedError(message);
      }
    }

    if (!response.ok) {
      // Path only: request bodies may carry card data and never go to logs.
      throw new Error(`Asaas ${method} ${path} → ${response.status}`);
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  async cardFee(installmentCount = 1): Promise<CardFee> {
    if (!this.fees || this.fees.expiresAt <= Date.now()) {
      const { payment } = await this.request<{
        payment: { creditCard: AsaasCardFees };
      }>('GET', '/myAccount/fees/');
      this.fees = {
        value: payment.creditCard,
        expiresAt: Date.now() + FEE_TTL_MS,
      };
    }

    return asaasCardFee(this.fees.value, installmentCount);
  }

  /** One Asaas customer per company, refreshed with the payer's data. */
  private async upsertCustomer(request: CardSubscriptionRequest) {
    const externalReference = `${ASAAS_REFERENCE_PREFIX}company:${request.companyId}`;
    const { holder } = request;
    const data = {
      name: holder.name,
      email: holder.email,
      cpfCnpj: holder.cpfCnpj,
      mobilePhone: holder.phone,
      postalCode: holder.postalCode,
      addressNumber: holder.addressNumber,
      complement: holder.addressComplement,
      externalReference,
      notificationDisabled: true,
    };
    const existing = await this.request<{ data: Array<{ id: string }> }>(
      'GET',
      `/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
    );
    const id = existing.data[0]?.id;

    return id
      ? this.request<{ id: string }>('POST', `/customers/${id}`, data)
      : this.request<{ id: string }>('POST', '/customers', data);
  }

  async subscribeWithCard(
    request: CardSubscriptionRequest,
  ): Promise<CardSubscriptionResult> {
    const customer = await this.upsertCustomer(request);
    const yearly = request.billingCycle === 'YEARLY';
    const { holder } = request;
    const card = {
      externalReference: `${ASAAS_REFERENCE_PREFIX}checkout:${request.checkoutId}`,
      description: `LinkBuds ${request.planName} (${yearly ? 'anual' : 'mensal'})`,
      creditCard: request.card,
      creditCardHolderInfo: {
        name: holder.name,
        email: holder.email,
        cpfCnpj: holder.cpfCnpj,
        postalCode: holder.postalCode,
        addressNumber: holder.addressNumber,
        addressComplement: holder.addressComplement,
        mobilePhone: holder.phone,
      },
      remoteIp: request.remoteIp,
    };

    // Installments: one charge for the year split on the card (all parcels
    // are authorized now); BillingJobs renews it with the card token.
    if (request.installmentCount > 1) {
      const charge = await this.request<AsaasCardCharge>('POST', '/payments', {
        ...card,
        customer: customer.id,
        billingType: 'CREDIT_CARD',
        dueDate: todayInBrazil(),
        installmentCount: request.installmentCount,
        totalValue: request.amountCents / 100,
      });

      return {
        providerCustomerId: customer.id,
        providerSubscriptionId: charge.installment ?? charge.id,
        cardToken: charge.creditCard?.creditCardToken ?? null,
        firstPayment: {
          id: charge.id,
          status: paid(charge.status) ? 'PAID' : 'PENDING',
          amountCents: request.amountCents,
          dueDate: charge.dueDate,
        },
      };
    }

    const subscription = await this.request<{
      id: string;
      creditCard?: { creditCardToken?: string | null } | null;
    }>('POST', '/subscriptions', {
      ...card,
      customer: customer.id,
      billingType: 'CREDIT_CARD',
      nextDueDate: todayInBrazil(),
      value: request.amountCents / 100,
      cycle: yearly ? 'YEARLY' : 'MONTHLY',
    });
    const payments = await this.request<{ data: AsaasPayment[] }>(
      'GET',
      `/subscriptions/${subscription.id}/payments?limit=1`,
    );
    const first = payments.data[0];

    return {
      providerCustomerId: customer.id,
      providerSubscriptionId: subscription.id,
      cardToken: subscription.creditCard?.creditCardToken ?? null,
      firstPayment: {
        id: first?.id ?? `${subscription.id}:first`,
        status: first && paid(first.status) ? 'PAID' : 'PENDING',
        amountCents: first ? toCents(first.value) : request.amountCents,
        dueDate: first?.dueDate ?? todayInBrazil(),
      },
    };
  }

  async chargeCardToken(
    request: TokenChargeRequest,
  ): Promise<TokenChargeResult> {
    const externalReference = `${ASAAS_REFERENCE_PREFIX}${request.reference}`;
    // A retry after a timeout must not charge twice: reuse the earlier charge.
    const earlier = await this.request<{ data: AsaasCardCharge[] }>(
      'GET',
      `/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
    );
    const charge =
      earlier.data[0] ??
      (await this.request<AsaasCardCharge>('POST', '/payments', {
        customer: request.providerCustomerId,
        billingType: 'CREDIT_CARD',
        dueDate: todayInBrazil(),
        description: request.description,
        externalReference,
        creditCardToken: request.cardToken,
        ...(request.installmentCount > 1
          ? {
              installmentCount: request.installmentCount,
              totalValue: request.amountCents / 100,
            }
          : { value: request.amountCents / 100 }),
      }));

    if (!paid(charge.status)) {
      throw new PaymentDeclinedError('Pagamento da renovação não confirmado.');
    }

    return {
      providerChargeId: charge.installment ?? charge.id,
      firstPaymentId: charge.id,
      dueDate: charge.dueDate,
    };
  }

  async getPaymentDetails(paymentId: string): Promise<PaymentDetails | null> {
    const payment = await this.request<{
      status?: string;
      deleted?: boolean;
      transactionReceiptUrl?: string | null;
      creditCard?: {
        creditCardBrand?: string | null;
        creditCardNumber?: string | null;
      } | null;
    }>('GET', `/payments/${encodeURIComponent(paymentId)}`);

    if (!payment.status || payment.deleted) return null;

    const card = payment.creditCard;

    return {
      status: paid(payment.status)
        ? 'PAID'
        : payment.status.startsWith('REFUND')
          ? 'REFUNDED'
          : payment.status === 'PENDING' ||
              payment.status === 'AWAITING_RISK_ANALYSIS'
            ? 'PENDING'
            : 'FAILED',
      card:
        card?.creditCardBrand && card.creditCardNumber
          ? {
              brand: brandLabel(card.creditCardBrand),
              last4: card.creditCardNumber.slice(-4),
            }
          : null,
      receiptUrl: payment.transactionReceiptUrl ?? null,
    };
  }

  /** Stops renewals; Asaas also drops pending/overdue charges of it. */
  async cancelSubscription(providerSubscriptionId: string) {
    await this.request('DELETE', `/subscriptions/${providerSubscriptionId}`);
  }

  parseWebhook(
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
  ): BillingEvent | null {
    const received = headers[ASAAS_TOKEN_HEADER];

    if (
      typeof received !== 'string' ||
      received.length !== this.webhookToken.length ||
      !timingSafeEqual(Buffer.from(received), Buffer.from(this.webhookToken))
    ) {
      throw new Error('Invalid Asaas webhook token');
    }

    return toBillingEvent(JSON.parse(rawBody.toString('utf8')) as AsaasWebhook);
  }
}

/**
 * externalEventId is per payment + outcome, not Asaas' event id: a card
 * payment emits PAYMENT_CONFIRMED and later PAYMENT_RECEIVED for the same
 * money, and the API response already reported the first one. Each must
 * count once.
 */
export function toBillingEvent(body: AsaasWebhook): BillingEvent | null {
  const payment = body.payment;
  // Our charges belong to a gateway subscription (monthly/yearly recurring)
  // or to an installment plan (yearly split on the card).
  const contract = payment?.subscription ?? payment?.installment;
  const subscriptionPayment =
    contract && ours(payment?.externalReference)
      ? { ...payment!, subscription: contract }
      : null;

  switch (body.event) {
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED':
      if (!subscriptionPayment?.subscription) return null;
      // Installment parcels 2..n are part of the same, already counted charge.
      if ((subscriptionPayment.installmentNumber ?? 1) > 1) return null;
      return {
        type: 'INVOICE_PAID',
        externalEventId: `payment:${subscriptionPayment.id}:paid`,
        providerSubscriptionId: subscriptionPayment.subscription,
        providerCustomerId: subscriptionPayment.customer ?? null,
        invoiceId: subscriptionPayment.id,
        amountCents: toCents(subscriptionPayment.value),
        currentPeriodEnd: null,
        periodStart: subscriptionPayment.dueDate,
      };
    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
      if (!subscriptionPayment?.subscription) return null;
      return {
        type: 'PAYMENT_FAILED',
        externalEventId: `payment:${subscriptionPayment.id}:failed`,
        providerSubscriptionId: subscriptionPayment.subscription,
        invoiceId: subscriptionPayment.id,
        amountCents: toCents(subscriptionPayment.value),
      };
    case 'PAYMENT_REFUNDED':
      if (!subscriptionPayment?.subscription) return null;
      return {
        type: 'REFUNDED',
        externalEventId: `payment:${subscriptionPayment.id}:refunded`,
        providerSubscriptionId: subscriptionPayment.subscription,
        refundId: subscriptionPayment.id,
        amountCents: toCents(subscriptionPayment.value),
      };
    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_INACTIVATED':
      if (!body.subscription || !ours(body.subscription.externalReference)) {
        return null;
      }
      return {
        type: 'SUBSCRIPTION_CANCELED',
        externalEventId: `subscription:${body.subscription.id}:canceled`,
        providerSubscriptionId: body.subscription.id,
      };
    default:
      return null;
  }
}
