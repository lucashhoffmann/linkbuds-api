export const PRICING_PLANS_CATALOG_FEATURE = 'pricing_plans_catalog';

export const PRICING_PLANS_CATALOG_DESCRIPTION =
  'Catalogo publico de precos e regras dos planos Linkbuds';

export type PricingPlansCatalogPayload = {
  yearlyDiscountPercent: number;
  plans: {
    FREE: {
      active: boolean;
      maxClientPages: number;
      priceCents: number;
    };
    AGENCY: {
      active: boolean;
      maxClientPages: number;
      priceCents: number;
    };
  };
  custom: {
    active: boolean;
    minClientPages: number;
    consultationMinClientPages: number;
    baseUnitPriceCents: number;
    stepClientPages: number;
    stepIncrementCents: number;
  };
};

export const PRICING_PLANS_CATALOG_PAYLOAD: PricingPlansCatalogPayload = {
  yearlyDiscountPercent: 25,
  plans: {
    FREE: {
      active: true,
      maxClientPages: 1,
      priceCents: 0,
    },
    AGENCY: {
      active: true,
      maxClientPages: 20,
      priceCents: 18000,
    },
  },
  custom: {
    active: true,
    minClientPages: 21,
    consultationMinClientPages: 50,
    baseUnitPriceCents: 2000,
    stepClientPages: 5,
    stepIncrementCents: 200,
  },
};
