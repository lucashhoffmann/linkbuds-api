import { priceFor } from '../domain/pricing';

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
