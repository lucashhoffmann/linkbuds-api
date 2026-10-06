import { priceFor, withCardFee } from '../domain/pricing';

const free = { id: 'free', priceCents: 0 } as never;
const agency = { id: 'agency', priceCents: 18000 } as never;
const now = new Date('2026-10-03T12:00:00Z');
const condition = (overrides: Record<string, unknown>) =>
  ({
    planId: null,
    priceCents: null,
    discountPercent: null,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: null,
    deletedAt: null,
    ...overrides,
  }) as never;

describe('priceFor', () => {
  it('charges the plan price, with the yearly discount on 12 months', () => {
    const company = { plan: free, conditions: [] };

    expect(priceFor(company, agency, 'MONTHLY', now)).toBe(18000);
    expect(priceFor(company, agency, 'YEARLY', now)).toBe(162000); // 216000 - 25%
  });

  it('applies a special condition price only to its own plan', () => {
    const company = {
      plan: free,
      conditions: [condition({ planId: 'agency', priceCents: 9900 })],
    };

    expect(priceFor(company, agency, 'MONTHLY', now)).toBe(9900);
  });

  it('applies a condition discount to any plan', () => {
    const company = {
      plan: free,
      conditions: [condition({ discountPercent: 30 })],
    };

    expect(priceFor(company, agency, 'MONTHLY', now)).toBe(12600);
  });

  it('is free under the "unlock everything" coupon condition', () => {
    const company = {
      plan: free,
      conditions: [condition({ planId: 'agency', priceCents: 0 })],
    };

    expect(priceFor(company, agency, 'MONTHLY', now)).toBe(0);
    expect(priceFor(company, agency, 'YEARLY', now)).toBe(0);
  });
});

describe('withCardFee', () => {
  const asaas = { percent: 2.99, fixedCents: 49 };

  it('grosses up so the net after the gateway fee covers the price', () => {
    for (const base of [100, 4990, 18000, 162000, 999999]) {
      const { totalCents, feeCents } = withCardFee(base, asaas);
      const gatewayFee = Math.round((totalCents * 2.99) / 100 + 49);

      expect(totalCents - gatewayFee).toBeGreaterThanOrEqual(base);
      expect(totalCents - gatewayFee - base).toBeLessThanOrEqual(1);
      expect(feeCents).toBe(totalCents - base);
    }
  });

  it('matches the sandbox: R$ 49,90 net → R$ 51,95 charged', () => {
    expect(withCardFee(4990, asaas).totalCents).toBe(5195);
  });

  it('charges nothing extra when there is no fee or no price', () => {
    expect(withCardFee(4990, { percent: 0, fixedCents: 0 }).totalCents).toBe(
      4990,
    );
    expect(withCardFee(0, asaas).totalCents).toBe(0);
  });
});
