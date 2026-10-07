import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import {
  type BillingEvent,
  type CardSubscriptionRequest,
  type CardSubscriptionResult,
  PaymentDeclinedError,
  type PaymentDetails,
  type PaymentProvider,
  type TokenChargeRequest,
  type TokenChargeResult,
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
 * Development/test gateway: no money moves and no fee. Any card is approved
 * except one ending in 0002. Renewals/failures can be simulated by POSTing a
 * signed BillingEvent to /billing/webhooks/fake.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake';

  cardFee() {
    return Promise.resolve({ percent: 0, fixedCents: 0 });
  }

  subscribeWithCard(
    request: CardSubscriptionRequest,
  ): Promise<CardSubscriptionResult> {
    if (request.card.number.endsWith('0002')) {
      return Promise.reject(
        new PaymentDeclinedError('Transação não autorizada (cartão de teste).'),
      );
    }

    const id = randomBytes(8).toString('hex');

    return Promise.resolve({
      providerCustomerId: `fake_cus_${request.companyId}`,
      providerSubscriptionId: `fake_sub_${id}`,
      cardToken: `fake_tok_${id}`,
      firstPayment: {
        id: `fake_pay_${id}`,
        status: 'PAID',
        amountCents: request.amountCents,
        dueDate: new Date().toISOString().slice(0, 10),
      },
    });
  }

  /** Renewals always succeed (one charge per reference). */
  chargeCardToken(request: TokenChargeRequest): Promise<TokenChargeResult> {
    const id = createHmac('sha256', secret())
      .update(request.reference)
      .digest('hex')
      .slice(0, 16);

    return Promise.resolve({
      providerChargeId: `fake_inst_${id}`,
      firstPaymentId: `fake_pay_${id}`,
      dueDate: new Date().toISOString().slice(0, 10),
    });
  }

  getPaymentDetails(): Promise<PaymentDetails> {
    return Promise.resolve({
      status: 'PAID',
      card: { brand: 'Teste', last4: '0000' },
    });
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
