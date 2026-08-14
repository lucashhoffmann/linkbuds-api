import { GetPricingPlansUseCase } from '../application/use-cases/get-pricing-plans.use-case';

describe('GetPricingPlansUseCase', () => {
  it('maps pricing plans from the pricing_plans_catalog parameter', async () => {
    const parametersRepository = {
      findOne: jest.fn().mockResolvedValue({
        payload: {
          yearlyDiscountPercent: 10,
          plans: {
            FREE: {
              maxClientPages: 1,
              priceCents: 0,
            },
            AGENCY: {
              maxClientPages: 5,
              priceCents: 25000,
            },
          },
          custom: {
            minClientPages: 6,
            consultationMinClientPages: 40,
            baseUnitPriceCents: 3000,
            stepClientPages: 5,
            stepIncrementCents: 500,
          },
        },
      }),
    };
    const useCase = new GetPricingPlansUseCase(parametersRepository as any);

    const response = await useCase.execute();

    expect(parametersRepository.findOne).toHaveBeenCalledWith({
      where: { feature: 'pricing_plans_catalog', isActive: true },
    });
    expect(response.yearlyDiscountPercent).toBe(10);
    expect(response.custom.baseUnitPriceCents).toBe(3000);
    expect(response.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'FREE',
          active: true,
          maxClientPages: 1,
          priceCents: 0,
        }),
        expect.objectContaining({
          code: 'AGENCY',
          active: true,
          maxClientPages: 5,
          priceCents: 25000,
        }),
        expect.objectContaining({
          code: 'CUSTOM',
          active: true,
          maxClientPages: null,
          priceCents: null,
        }),
      ]),
    );
    expect(
      response.plans.find((plan) => plan.code === 'AGENCY')?.features,
    ).toEqual(expect.arrayContaining(['Ate 5 paginas de clientes']));
    expect(
      response.plans.find((plan) => plan.code === 'FREE')?.features,
    ).toEqual(expect.arrayContaining(['Dominio personalizado']));
  });

  it('does not return plans disabled in the pricing catalog parameter', async () => {
    const parametersRepository = {
      findOne: jest.fn().mockResolvedValue({
        payload: {
          yearlyDiscountPercent: 25,
          plans: {
            FREE: {
              active: false,
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
            active: false,
            minClientPages: 21,
            consultationMinClientPages: 50,
            baseUnitPriceCents: 2000,
            stepClientPages: 5,
            stepIncrementCents: 200,
          },
        },
      }),
    };
    const useCase = new GetPricingPlansUseCase(parametersRepository as any);

    const response = await useCase.execute();

    expect(response.plans.map((plan) => plan.code)).toEqual(['AGENCY']);
  });
});
