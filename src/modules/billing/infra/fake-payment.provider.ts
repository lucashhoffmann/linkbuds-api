import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type {
  BillingEvent,
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
} from '../application/payment-provider';

export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';

function secret() {
  return (
    process.env.BILLING_FAKE_SECRET?.trim() || 'dev-only-fake-billing-secret'
  );
}

export function signFakePayload(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/**
 * Development/test gateway: no money moves. Checkout "completes" through
 * POST /billing/fake/checkouts/:session/complete, which emits a signed
 * webhook through the same pipeline a real gateway would use.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const providerSessionId = `fake_cs_${randomBytes(12).toString('hex')}`;
    const url = new URL(request.successUrl);
    url.searchParams.set('checkout', 'fake');
    url.searchParams.set('session', providerSessionId);

    return Promise.resolve({ providerSessionId, checkoutUrl: url.toString() });
  }

  cancelSubscription(): Promise<void> {
    return Promise.resolve();
  }

  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): BillingEvent {
    const received = headers[FAKE_SIGNATURE_HEADER];
    const expected = signFakePayload(rawBody.toString('utf8'));

    if (
      typeof received !== 'string' ||
      received.length !== expected.length ||
      !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    ) {
      throw new Error('Invalid fake webhook signature');
    }

    return JSON.parse(rawBody.toString('utf8')) as BillingEvent;
  }
}
