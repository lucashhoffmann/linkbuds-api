import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { assertEntitled, entitlementsFor } from '../domain/entitlements';

const free = {
  code: 'FREE',
  priceCents: 0,
  maxClientPages: 1,
  analyticsTier: 'BASIC',
  customDomain: true,
  whiteLabel: false,
} as never;
const agency = {
  code: 'AGENCY',
  priceCents: 18000,
  maxClientPages: 20,
  analyticsTier: 'FULL',
  customDomain: true,
  whiteLabel: true,
} as never;
const now = new Date('2026-10-03T12:00:00Z');

function condition(overrides: Record<string, unknown>) {
  return {
    plan: null,
    maxClientPages: null,
    analyticsTier: null,
    customDomain: null,
    whiteLabel: null,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: null,
    deletedAt: null,
    ...overrides,
  } as never;
}

describe('entitlementsFor', () => {
  it('uses the plan when there is no active condition', () => {
    expect(entitlementsFor({ plan: free }, now)).toEqual({
      planCode: 'FREE',
      freePlan: true,
      maxClientPages: 1,
      analyticsTier: 'BASIC',
      customDomain: true,
      whiteLabel: false,
      custom: false,
    });
  });

  it('applies overrides of the active condition over its base plan', () => {
    const result = entitlementsFor(
      {
        plan: free,
        conditions: [condition({ plan: agency, maxClientPages: 50 })],
      },
      now,
    );

    expect(result).toEqual({
      planCode: 'AGENCY',
      freePlan: false,
      maxClientPages: 50,
      analyticsTier: 'FULL',
      customDomain: true,
      whiteLabel: true,
      custom: true,
    });
  });

  it('ignores expired, future and deleted conditions', () => {
    const conditions = [
      condition({
        maxClientPages: 5,
        endsAt: new Date('2026-10-02T00:00:00Z'),
      }),
      condition({
        maxClientPages: 6,
        startsAt: new Date('2026-11-01T00:00:00Z'),
      }),
      condition({ maxClientPages: 7, deletedAt: new Date() }),
    ];

    expect(entitlementsFor({ plan: free, conditions }, now)).toMatchObject({
      maxClientPages: 1,
      custom: false,
    });
  });

  it('picks the most recent active condition', () => {
    const conditions = [
      condition({ maxClientPages: 5 }),
      condition({
        maxClientPages: 9,
        startsAt: new Date('2026-10-02T00:00:00Z'),
      }),
    ];

    expect(
      entitlementsFor({ plan: free, conditions }, now).maxClientPages,
    ).toBe(9);
  });

  it('rejects features the company is not entitled to', () => {
    expect(() => assertEntitled({ plan: free }, 'whiteLabel')).toThrow(
      expect.objectContaining({
        errorCode: ERROR_CODES.LINK_PAGE_FEATURE_FORBIDDEN,
      }),
    );
  });
});
