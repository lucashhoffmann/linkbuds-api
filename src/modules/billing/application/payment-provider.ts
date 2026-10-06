import type { IncomingHttpHeaders } from 'node:http';
import type { BillingCycle } from '../domain/entities/subscription.entity';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CheckoutRequest {
  checkoutId: string;
  companyId: string;
  customerEmail: string;
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface CheckoutSession {
  providerSessionId: string;
  checkoutUrl: string;
}

/** Provider events normalized to what billing needs. */
export type BillingEvent =
  | {
      type: 'CHECKOUT_COMPLETED';
      externalEventId: string;
      providerSessionId: string;
      providerCustomerId: string | null;
      providerSubscriptionId: string;
      amountCents: number;
      currentPeriodEnd: string;
    }
  | {
      type: 'INVOICE_PAID';
      externalEventId: string;
      providerSubscriptionId: string;
      invoiceId: string;
      amountCents: number;
      currentPeriodEnd: string;
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
 * (see infra/fake-payment.provider.ts); billing logic never changes.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  /** Verifies the signature and normalizes the payload. Throws if invalid. */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): BillingEvent;
}
