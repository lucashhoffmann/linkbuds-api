import { AppAbilityFactory } from 'src/modules/authorization/application/app-ability.factory';
import { PlanType } from 'src/modules/plan/domain/enums/plan-type.enum';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { CompanyDomainService } from '../application/company-domain.service';
import { CompanyDomainStatus } from '../domain/enums/company-domain-status.enum';

function createRepositoryMock() {
  return {
    create: jest.fn((value) => value),
    findOne: jest.fn(),
    save: jest.fn((value) => Promise.resolve({ id: 'domain-id', ...value })),
    softDelete: jest.fn(),
  };
}

function createService() {
  const companyRepository = createRepositoryMock();
  const domainRepository = createRepositoryMock();
  const verificationService = {
    verifyCname: jest.fn(),
  };
  const service = new CompanyDomainService(
    new AppAbilityFactory(),
    verificationService as never,
    companyRepository as never,
    domainRepository as never,
  );

  companyRepository.findOne.mockResolvedValue({
    id: 'company-id',
    plan: {
      type: PlanType.FREE,
      customDomainEnabled: false,
      whiteLabelEnabled: false,
    },
  });

  return {
    companyRepository,
    domainRepository,
    service,
    verificationService,
  };
}

const auth = {
  id: 'user-id',
  companyId: 'company-id',
};

describe('CompanyDomainService', () => {
  it('allows free plans to create a custom domain', async () => {
    const { domainRepository, service } = createService();
    domainRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(auth, { hostname: 'https://Example.com/' }),
    ).resolves.toMatchObject({
      hostname: 'example.com',
      status: CompanyDomainStatus.PENDING,
    });
    expect(domainRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-id',
        hostname: 'example.com',
        status: CompanyDomainStatus.PENDING,
      }),
    );
  });

  it('returns conflict instead of 500 when hostname unique constraint is hit', async () => {
    const { domainRepository, service } = createService();
    const error = new Error('duplicate key value violates unique constraint');
    Object.assign(error, {
      driverError: {
        constraint: 'UQ_company_domains_hostname',
      },
    });
    Object.setPrototypeOf(error, Error.prototype);

    domainRepository.findOne.mockResolvedValue(null);
    domainRepository.save.mockRejectedValue(error);

    await expect(
      service.create(auth, { hostname: 'example.com' }),
    ).rejects.toMatchObject({
      errorCode: ERROR_CODES.COMPANY_DOMAIN_ALREADY_EXISTS,
    });
  });

  it('allows free plans to verify a custom domain', async () => {
    const { domainRepository, service, verificationService } = createService();
    domainRepository.findOne.mockResolvedValue({
      id: 'domain-id',
      companyId: 'company-id',
      hostname: 'example.com',
      status: CompanyDomainStatus.PENDING,
      verificationToken: 'linksbuds-token',
      verifiedAt: null,
      lastCheckedAt: null,
    });
    verificationService.verifyCname.mockResolvedValue(true);

    await expect(service.verify(auth, 'domain-id')).resolves.toMatchObject({
      hostname: 'example.com',
      status: CompanyDomainStatus.ACTIVE,
    });
    expect(verificationService.verifyCname).toHaveBeenCalledWith('example.com');
  });

  it('allows free plans to remove a custom domain', async () => {
    const { domainRepository, service } = createService();
    domainRepository.softDelete.mockResolvedValue({ affected: 1 });

    await expect(service.delete(auth, 'domain-id')).resolves.toEqual({
      message: 'Domínio removido com sucesso',
    });
    expect(domainRepository.softDelete).toHaveBeenCalledWith({
      id: 'domain-id',
      companyId: 'company-id',
    });
  });
});
