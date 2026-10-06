import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import {
  CompanyDomainService,
  nextDomainStatus,
} from '../application/company-domain.service';
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
    check: jest.fn(),
  };
  const publicCache = { invalidateHost: jest.fn() };
  const service = new CompanyDomainService(
    verificationService as never,
    publicCache as never,
    companyRepository as never,
    domainRepository as never,
  );

  companyRepository.findOne.mockResolvedValue({
    id: 'company-id',
    plan: {
      customDomain: true,
      whiteLabel: false,
    },
  });

  return {
    companyRepository,
    domainRepository,
    publicCache,
    service,
    verificationService,
  };
}

const auth = {
  id: 'user-id',
  companyId: 'company-id',
  role: UserRole.OWNER,
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
      verificationToken: 'linkbuds-token',
      verifiedAt: null,
      lastCheckedAt: null,
    });
    verificationService.check.mockResolvedValue({
      ownership: true,
      routing: true,
    });

    await expect(service.verify(auth, 'domain-id')).resolves.toMatchObject({
      hostname: 'example.com',
      status: CompanyDomainStatus.ACTIVE,
      dnsRecords: [
        {
          type: 'TXT',
          name: '_linkbuds.example.com',
          value: 'linkbuds-token',
        },
        { type: 'CNAME', name: 'example.com' },
      ],
    });
    expect(verificationService.check).toHaveBeenCalledWith(
      'example.com',
      'linkbuds-token',
    );
  });

  it('moves domains through ownership and routing checks', () => {
    const { PENDING, VERIFIED, ACTIVE, FAILED } = CompanyDomainStatus;
    const ok = { ownership: true, routing: true };

    expect(nextDomainStatus(PENDING, { ownership: false, routing: true })).toBe(
      PENDING,
    );
    expect(nextDomainStatus(PENDING, { ownership: true, routing: false })).toBe(
      VERIFIED,
    );
    expect(nextDomainStatus(VERIFIED, ok)).toBe(ACTIVE);
    expect(nextDomainStatus(ACTIVE, { ownership: true, routing: false })).toBe(
      VERIFIED,
    );
    expect(nextDomainStatus(ACTIVE, { ownership: false, routing: true })).toBe(
      FAILED,
    );
    expect(nextDomainStatus(FAILED, ok)).toBe(ACTIVE);
  });

  it('drops the public cache when an active domain stops routing', async () => {
    const { domainRepository, publicCache, service, verificationService } =
      createService();
    domainRepository.findOne.mockResolvedValue({
      id: 'domain-id',
      companyId: 'company-id',
      hostname: 'example.com',
      status: CompanyDomainStatus.ACTIVE,
      verificationToken: 'linkbuds-token',
      verifiedAt: new Date(),
    });
    verificationService.check.mockResolvedValue({
      ownership: true,
      routing: false,
    });

    await service.verify(auth, 'domain-id');

    expect(publicCache.invalidateHost).toHaveBeenCalledWith('example.com');
  });

  it('allows free plans to remove a custom domain', async () => {
    const { domainRepository, publicCache, service } = createService();
    domainRepository.findOne.mockResolvedValue({
      id: 'domain-id',
      hostname: 'example.com',
    });

    await expect(service.delete(auth, 'domain-id')).resolves.toEqual({
      message: 'Domínio removido com sucesso',
    });
    expect(domainRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'domain-id', companyId: 'company-id' },
    });
    expect(domainRepository.softDelete).toHaveBeenCalledWith({
      id: 'domain-id',
    });
    expect(publicCache.invalidateHost).toHaveBeenCalledWith('example.com');
  });
});
