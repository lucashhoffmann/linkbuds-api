import { GetPricingPlansUseCase } from '../application/use-cases/get-pricing-plans.use-case';

describe('GetPricingPlansUseCase', () => {
  it('lists public active plans from the catalog plus the custom contact card', async () => {
    const find = jest.fn().mockResolvedValue([
      {
        code: 'FREE',
        name: 'Grátis',
        label: 'Inicial',
        description: 'd',
        maxClientPages: 1,
        priceCents: 0,
        features: ['a'],
        actionLabel: 'Começar grátis',
        featured: false,
      },
    ]);
    const useCase = new GetPricingPlansUseCase({ find } as never);

    const result = await useCase.execute();

    expect(find).toHaveBeenCalledWith({
      where: { public: true, active: true },
      order: { sortOrder: 'ASC' },
    });
    expect(result.plans.map((plan) => plan.code)).toEqual(['FREE', 'CUSTOM']);
    expect(result.plans[0]).toMatchObject({
      action: 'Começar grátis',
      custom: false,
    });
    expect(result.plans[1]).toMatchObject({ custom: true, priceCents: null });
  });
});
