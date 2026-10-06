import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AdminApiKeyGuard } from 'src/shared/guards/admin-api-key.guard';
import { CompanyConditionsService } from '../application/company-conditions.service';
import { createCompanyConditionDto } from '../application/dto/company-condition.dto';

function contextWithKey(key?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: key ? { 'x-admin-key': key } : {} }),
    }),
  } as never;
}

describe('AdminApiKeyGuard', () => {
  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
  });

  it('accepts only the configured key and is disabled without one', () => {
    const guard = new AdminApiKeyGuard();

    expect(() => guard.canActivate(contextWithKey('x'))).toThrow(
      expect.objectContaining({ errorCode: ERROR_CODES.ADMIN_UNAUTHORIZED }),
    );

    process.env.ADMIN_API_KEY = 'secret-key';
    expect(guard.canActivate(contextWithKey('secret-key'))).toBe(true);
    expect(() => guard.canActivate(contextWithKey('wrong'))).toThrow();
    expect(() => guard.canActivate(contextWithKey())).toThrow();
  });
});

describe('createCompanyConditionDto', () => {
  it('requires at least one adjustment and a coherent period', () => {
    expect(createCompanyConditionDto.safeParse({ note: 'x' }).success).toBe(
      false,
    );
    expect(
      createCompanyConditionDto.safeParse({
        maxClientPages: 50,
        startsAt: '2026-11-01',
        endsAt: '2026-10-01',
      }).success,
    ).toBe(false);
    expect(
      createCompanyConditionDto.parse({
        planCode: 'AGENCY',
        endsAt: '2099-01-01',
      }),
    ).toMatchObject({ planCode: 'AGENCY', endsAt: new Date('2099-01-01') });
  });
});

describe('CompanyConditionsService', () => {
  function createService() {
    const companyRepository = {
      existsBy: jest.fn().mockResolvedValue(true),
      findOne: jest.fn().mockResolvedValue({
        id: 'company-id',
        name: 'Agência',
        email: 'a@a.com',
        plan: { code: 'FREE', maxClientPages: 1, analyticsTier: 'BASIC' },
      }),
    };
    const conditionRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      softDelete: jest.fn(),
    };
    const planRepository = { findOne: jest.fn() };
    const service = new CompanyConditionsService(
      companyRepository as never,
      conditionRepository as never,
      planRepository as never,
    );

    return { service, companyRepository, conditionRepository, planRepository };
  }

  it('creates a condition with the plan resolved by code', async () => {
    const { service, conditionRepository, planRepository } = createService();
    planRepository.findOne.mockResolvedValue({ id: 'agency-plan-id' });

    await service.create('company-id', {
      planCode: 'AGENCY',
      maxClientPages: 50,
    });

    expect(conditionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-id',
        planId: 'agency-plan-id',
        maxClientPages: 50,
        whiteLabel: null,
      }),
    );
  });

  it('rejects unknown plans and companies', async () => {
    const { service, companyRepository, planRepository } = createService();
    planRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create('company-id', { planCode: 'NOPE' }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.PLAN_NOT_FOUND });

    companyRepository.existsBy.mockResolvedValue(false);
    await expect(
      service.create('missing', { maxClientPages: 5 }),
    ).rejects.toMatchObject({ errorCode: ERROR_CODES.COMPANY_NOT_FOUND });
  });

  it('labels the condition history by status', async () => {
    const { service, conditionRepository } = createService();
    const now = new Date('2026-10-03T12:00:00Z');
    const base = {
      plan: null,
      maxClientPages: 5,
      startsAt: new Date('2026-10-01T00:00:00Z'),
      endsAt: null,
      deletedAt: null,
    };
    conditionRepository.find.mockResolvedValue([
      { ...base, id: 'active' },
      { ...base, id: 'revoked', deletedAt: new Date() },
      { ...base, id: 'future', startsAt: new Date('2026-12-01T00:00:00Z') },
      { ...base, id: 'old', endsAt: new Date('2026-10-02T00:00:00Z') },
    ]);

    const result = await service.getCompany('company-id', now);

    expect(result.conditions.map((c) => [c.id, c.status])).toEqual([
      ['active', 'ACTIVE'],
      ['revoked', 'REVOKED'],
      ['future', 'SCHEDULED'],
      ['old', 'EXPIRED'],
    ]);
    expect(result.entitlements).toMatchObject({
      maxClientPages: 5,
      custom: true,
    });
  });
});
