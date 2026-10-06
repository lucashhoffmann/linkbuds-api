import {
  ASAAS_TOKEN_HEADER,
  AsaasPaymentProvider,
  asaasCardFee,
  toBillingEvent,
} from '../infra/asaas-payment.provider';

const token = 'x'.repeat(40);
const provider = new AsaasPaymentProvider(
  'https://asaas.test/v3',
  'key',
  token,
);
const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  subscription: 'sub_1',
  customer: 'cus_1',
  externalReference: 'linkbuds:checkout:chk_1',
  value: 49.9,
  dueDate: '2026-10-06',
  ...overrides,
});
const webhook = (event: string, body: Record<string, unknown>) => ({
  id: `evt_${event}`,
  event,
  ...body,
});

describe('Asaas webhooks', () => {
  it('maps a paid subscription charge to INVOICE_PAID', () => {
    expect(
      toBillingEvent(webhook('PAYMENT_CONFIRMED', { payment: payment() })),
    ).toEqual({
      type: 'INVOICE_PAID',
      externalEventId: 'payment:pay_1:paid',
      providerSubscriptionId: 'sub_1',
      providerCustomerId: 'cus_1',
      invoiceId: 'pay_1',
      amountCents: 4990,
      currentPeriodEnd: null,
      periodStart: '2026-10-06',
    });
  });

  it('ignores charges and subscriptions of other apps on the account', () => {
    expect(
      toBillingEvent(
        webhook('PAYMENT_RECEIVED', {
          payment: payment({ externalReference: 'reseller:42' }),
        }),
      ),
    ).toBeNull();
    expect(
      toBillingEvent(
        webhook('SUBSCRIPTION_DELETED', {
          subscription: { id: 'sub_9', externalReference: null },
        }),
      ),
    ).toBeNull();
  });

  it('CONFIRMED and RECEIVED of the same payment dedupe in the inbox', () => {
    const confirmed = toBillingEvent(
      webhook('PAYMENT_CONFIRMED', { payment: payment() }),
    );
    const received = toBillingEvent(
      webhook('PAYMENT_RECEIVED', { payment: payment() }),
    );
    expect(confirmed?.externalEventId).toBe(received?.externalEventId);
  });

  it('maps failures, refunds and cancellations', () => {
    expect(
      toBillingEvent(webhook('PAYMENT_OVERDUE', { payment: payment() })),
    ).toMatchObject({ type: 'PAYMENT_FAILED', amountCents: 4990 });
    expect(
      toBillingEvent(webhook('PAYMENT_REFUNDED', { payment: payment() })),
    ).toMatchObject({ type: 'REFUNDED', refundId: 'pay_1' });
    expect(
      toBillingEvent(
        webhook('SUBSCRIPTION_DELETED', {
          subscription: {
            id: 'sub_1',
            externalReference: 'linkbuds:checkout:chk_1',
          },
        }),
      ),
    ).toMatchObject({
      type: 'SUBSCRIPTION_CANCELED',
      providerSubscriptionId: 'sub_1',
    });
  });

  it('ignores events billing does not use and one-off payments', () => {
    expect(
      toBillingEvent(webhook('PAYMENT_CREATED', { payment: payment() })),
    ).toBeNull();
    expect(
      toBillingEvent(
        webhook('PAYMENT_RECEIVED', {
          payment: payment({ subscription: null }),
        }),
      ),
    ).toBeNull();
  });

  it('rejects a missing or wrong token', () => {
    const body = Buffer.from(
      JSON.stringify(webhook('PAYMENT_RECEIVED', { payment: payment() })),
    );
    expect(() => provider.parseWebhook(body, {})).toThrow();
    expect(() =>
      provider.parseWebhook(body, { [ASAAS_TOKEN_HEADER]: 'y'.repeat(40) }),
    ).toThrow();
    expect(
      provider.parseWebhook(body, { [ASAAS_TOKEN_HEADER]: token }),
    ).toMatchObject({ type: 'INVOICE_PAID' });
  });

  it('counts an installment plan once, through its first parcel', () => {
    const parcel = (installmentNumber: number) =>
      payment({
        subscription: null,
        installment: 'inst_1',
        installmentNumber,
        value: 141.66,
      });

    expect(
      toBillingEvent(webhook('PAYMENT_CONFIRMED', { payment: parcel(1) })),
    ).toMatchObject({
      type: 'INVOICE_PAID',
      providerSubscriptionId: 'inst_1',
      invoiceId: 'pay_1',
    });
    expect(
      toBillingEvent(webhook('PAYMENT_CONFIRMED', { payment: parcel(2) })),
    ).toBeNull();
    // Refunds are per parcel and add up to the total.
    expect(
      toBillingEvent(webhook('PAYMENT_REFUNDED', { payment: parcel(7) })),
    ).toMatchObject({
      type: 'REFUNDED',
      providerSubscriptionId: 'inst_1',
      amountCents: 14166,
    });
  });
});

describe('asaasCardFee', () => {
  const fees = {
    operationValue: 0.49,
    oneInstallmentPercentage: 2.99,
    upToSixInstallmentsPercentage: 3.49,
    upToTwelveInstallmentsPercentage: 3.99,
    discountOneInstallmentPercentage: 1.99,
    discountUpToSixInstallmentsPercentage: 2.49,
    discountUpToTwelveInstallmentsPercentage: 2.99,
    hasValidDiscount: false,
  };

  it('uses the fee tier of the installment count', () => {
    expect(asaasCardFee(fees, 1)).toEqual({ percent: 2.99, fixedCents: 49 });
    expect(asaasCardFee(fees, 2).percent).toBe(3.49);
    expect(asaasCardFee(fees, 6).percent).toBe(3.49);
    expect(asaasCardFee(fees, 7).percent).toBe(3.99);
    expect(asaasCardFee(fees, 12).percent).toBe(3.99);
  });

  it('uses the discounted tier while the promo is valid', () => {
    const promo = { ...fees, hasValidDiscount: true };
    expect(asaasCardFee(promo, 1).percent).toBe(1.99);
    expect(asaasCardFee(promo, 12).percent).toBe(2.99);
  });
});

describe('Asaas payment details', () => {
  const respond = (body: unknown) =>
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

  afterEach(() => jest.restoreAllMocks());

  it('maps status, card and receipt for the receipt view', async () => {
    respond({
      status: 'CONFIRMED',
      transactionReceiptUrl: 'https://asaas.test/comprovantes/1',
      creditCard: {
        creditCardBrand: 'MASTERCARD',
        creditCardNumber: '8829',
      },
    });

    await expect(provider.getPaymentDetails('pay_1')).resolves.toEqual({
      status: 'PAID',
      card: { brand: 'Mastercard', last4: '8829' },
      receiptUrl: 'https://asaas.test/comprovantes/1',
    });
  });

  it('reports refunds and drops deleted charges', async () => {
    respond({ status: 'REFUNDED', creditCard: null });
    await expect(provider.getPaymentDetails('pay_1')).resolves.toMatchObject({
      status: 'REFUNDED',
      card: null,
    });

    respond({ status: 'PENDING', deleted: true });
    await expect(provider.getPaymentDetails('pay_1')).resolves.toBeNull();
  });
});
