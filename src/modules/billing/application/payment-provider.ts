import type { IncomingHttpHeaders } from 'node:http';
import type { BillingCycle } from '../domain/entities/subscription.entity';

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');

/**
 * `active` takes new checkouts (null = checkout disabled). `byName` holds
 * every configured gateway, so records of a former one (their `provider`
 * column) keep getting webhooks, cancel, renewals and receipts.
 */
export interface PaymentProviders {
  active: PaymentProvider | null;
  byName: ReadonlyMap<string, PaymentProvider>;
}

/** Gateway card fee: `percent`% of the charge + `fixedCents`. */
export interface CardFee {
  percent: number;
  fixedCents: number;
}

/** Card data only passes through: never logged, stored or hashed. */
export interface CardSubscriptionRequest {
  checkoutId: string;
  companyId: string;
  planName: string;
  billingCycle: BillingCycle;
  /** Total charged now (fee included). */
  amountCents: number;
  /** 1 = recurring subscription; 2–12 = yearly total split on the card. */
  installmentCount: number;
  holder: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
  };
  card: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  /** Payer's IP (anti-fraud), not the server's. */
  remoteIp: string;
}

export interface CardSubscriptionResult {
  providerCustomerId: string;
  /** Gateway subscription, or the installment plan when installmentCount > 1. */
  providerSubscriptionId: string;
  /** For renewing installment plans without the card again. */
  cardToken: string | null;
  /** First charge; PAID = card captured now, PENDING = a webhook will tell. */
  firstPayment: {
    id: string;
    status: 'PAID' | 'PENDING';
    amountCents: number;
    dueDate: string;
  };
}

/** Renewal of an installment plan with the stored card token. */
export interface TokenChargeRequest {
  providerCustomerId: string;
  cardToken: string;
  amountCents: number;
  installmentCount: number;
  description: string;
  /** Unique per renewal: a retry finds the earlier charge instead of charging again. */
  reference: string;
}

export interface TokenChargeResult {
  /** Installment plan (or single charge) id: the new providerSubscriptionId. */
  providerChargeId: string;
  firstPaymentId: string;
  dueDate: string;
}

/** What the gateway knows about one charge, for the payer's receipt view. */
export interface PaymentDetails {
  status: 'PAID' | 'PENDING' | 'REFUNDED' | 'FAILED';
  card: { brand: string; last4: string } | null;
}

/** The gateway refused the card or the payer data; message is user-facing. */
export class PaymentDeclinedError extends Error {}

/** Provider events normalized to what billing needs. */
export type BillingEvent =
  | {
      type: 'INVOICE_PAID';
      externalEventId: string;
      providerSubscriptionId: string;
      providerCustomerId?: string | null;
      invoiceId: string;
      amountCents: number;
      /** null = derive from periodStart (or now) + billing cycle. */
      currentPeriodEnd: string | null;
      periodStart?: string;
    }
  | {
      type: 'PAYMENT_FAILED';
      externalEventId: string;
      providerSubscriptionId: string;
      invoiceId: string;
      amountCents: number;
    }
  | {
      type: 'SUBSCRIPTION_CANCELED';
      externalEventId: string;
      providerSubscriptionId: string;
    }
  | {
      type: 'REFUNDED';
      externalEventId: string;
      providerSubscriptionId: string;
      refundId: string;
      amountCents: number;
    };

/**
 * Port to a payment gateway. Swapping gateways = one new implementation
 * (see infra/asaas-payment.provider.ts); billing logic never changes.
 */
export interface PaymentProvider {
  readonly name: string;
  /** Fee for a card charge split in `installmentCount` (1 = single). */
  cardFee(installmentCount?: number): Promise<CardFee>;
  /** Throws PaymentDeclinedError when the card/payer data is refused. */
  subscribeWithCard(
    request: CardSubscriptionRequest,
  ): Promise<CardSubscriptionResult>;
  /** Throws PaymentDeclinedError when refused. Idempotent per `reference`. */
  chargeCardToken(request: TokenChargeRequest): Promise<TokenChargeResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  /** Next charges of a recurring subscription use the new value (plan upgrade). */
  updateSubscription(
    providerSubscriptionId: string,
    change: { amountCents: number; description: string },
  ): Promise<void>;
  /** null when the gateway does not know the charge. */
  getPaymentDetails(paymentId: string): Promise<PaymentDetails | null>;
  /**
   * Verifies the signature and normalizes the payload. Throws if invalid;
   * null = authentic event billing does not care about (acknowledged, ignored).
   */
  parseWebhook(
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
  ): BillingEvent | null;
}
