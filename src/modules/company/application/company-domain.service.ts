import { Injectable } from '@nestjs/common';
import { normalizeHostname } from 'src/shared/utils/hostname';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import {
  ENTITLEMENT_RELATIONS,
  assertEntitled,
} from 'src/modules/plan/domain/entitlements';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { CompanyDomainEntity } from '../domain/entities/company-domain.entity';
import { CompanyEntity } from '../domain/entities/company.entity';
import { CompanyDomainStatus } from '../domain/enums/company-domain-status.enum';
import { getCustomDomainCnameTarget } from './company-domain-cname-target';
import { CreateCompanyDomainDto } from './dto/company-domain.dto';
import { PublicLinkPageCacheService } from 'src/modules/link-page/application/public-link-page-cache.service';
import {
  type DomainCheck,
  DomainVerificationService,
  VERIFICATION_RECORD_PREFIX,
} from './domain-verification.service';

function isValidHostname(hostname: string) {
  if (!hostname || hostname.length > 253 || hostname.includes(':')) {
    return false;
  }

  return hostname
    .split('.')
    .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function uniqueConstraintName(error: unknown) {
  if (
    !(error instanceof QueryFailedError) &&
    !(typeof error === 'object' && error !== null && 'driverError' in error)
  ) {
    return null;
  }

  return (
    error as {
      driverError?: { constraint?: string };
    }
  ).driverError?.constraint;
}

/**
 * PENDING → VERIFIED (TXT ok) → ACTIVE (TXT + routing ok).
 * A domain that was proven before and loses the TXT becomes FAILED.
 */
export function nextDomainStatus(
  current: CompanyDomainStatus,
  check: DomainCheck,
): CompanyDomainStatus {
  if (check.ownership) {
    return check.routing
      ? CompanyDomainStatus.ACTIVE
      : CompanyDomainStatus.VERIFIED;
  }

  return current === CompanyDomainStatus.PENDING
    ? CompanyDomainStatus.PENDING
    : CompanyDomainStatus.FAILED;
}

function toCompanyDomainResponse(domain: CompanyDomainEntity) {
  const cnameTarget = getCustomDomainCnameTarget();

  return {
    id: domain.id,
    hostname: domain.hostname,
    status: domain.status,
    verificationToken: domain.verificationToken,
    verifiedAt: domain.verifiedAt,
    lastCheckedAt: domain.lastCheckedAt,
    // Both records are required: TXT proves ownership, CNAME routes traffic.
    dnsRecords: [
      {
        purpose: 'OWNERSHIP',
        type: 'TXT',
        name: `${VERIFICATION_RECORD_PREFIX}.${domain.hostname}`,
        value: domain.verificationToken,
      },
      {
        purpose: 'ROUTING',
        type: 'CNAME',
        name: domain.hostname,
        value: cnameTarget,
      },
    ],
  };
}

@Injectable()
export class CompanyDomainService {
  constructor(
    private readonly verificationService: DomainVerificationService,
    private readonly publicCache: PublicLinkPageCacheService,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
    @InjectRepository(CompanyDomainEntity)
    private readonly domainRepository: Repository<CompanyDomainEntity>,
  ) {}

  private async getCompany(auth: AuthPayload) {
    const company = await this.companyRepository.findOne({
      where: { id: auth.companyId },
      relations: ENTITLEMENT_RELATIONS,
    });

    if (!company) {
      throw new AppException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    return company;
  }

  private async assertCanManage(auth: AuthPayload) {
    const company = await this.getCompany(auth);
    assertEntitled(company, 'customDomain');
  }

  async get(auth: AuthPayload) {
    const domain = await this.domainRepository.findOne({
      where: { companyId: auth.companyId },
      order: { createdAt: 'DESC' },
    });

    return domain ? toCompanyDomainResponse(domain) : null;
  }

  async create(auth: AuthPayload, dto: CreateCompanyDomainDto) {
    await this.assertCanManage(auth);
    const hostname = normalizeHostname(dto.hostname);

    if (!isValidHostname(hostname)) {
      throw new AppException(ERROR_CODES.COMPANY_DOMAIN_INVALID_HOSTNAME);
    }

    const [existingCompanyDomain, existingHostname] = await Promise.all([
      this.domainRepository.findOne({ where: { companyId: auth.companyId } }),
      this.domainRepository.findOne({ where: { hostname } }),
    ]);

    if (existingCompanyDomain) {
      throw new AppException(ERROR_CODES.COMPANY_DOMAIN_LIMIT_REACHED);
    }

    if (existingHostname) {
      throw new AppException(ERROR_CODES.COMPANY_DOMAIN_ALREADY_EXISTS);
    }

    try {
      const domain = await this.domainRepository.save(
        this.domainRepository.create({
          companyId: auth.companyId,
          hostname,
          status: CompanyDomainStatus.PENDING,
          verificationToken: `linkbuds-${randomBytes(18).toString('hex')}`,
        }),
      );

      return toCompanyDomainResponse(domain);
    } catch (error) {
      const constraint = uniqueConstraintName(error);

      if (
        constraint === 'UQ_company_domains_hostname' ||
        constraint === 'UQ_company_domains_hostname_active'
      ) {
        throw new AppException(ERROR_CODES.COMPANY_DOMAIN_ALREADY_EXISTS);
      }

      if (constraint === 'UQ_company_domains_company_active') {
        throw new AppException(ERROR_CODES.COMPANY_DOMAIN_LIMIT_REACHED);
      }

      throw error;
    }
  }

  async verify(auth: AuthPayload, id: string) {
    await this.assertCanManage(auth);
    const domain = await this.domainRepository.findOne({
      where: { id, companyId: auth.companyId },
    });

    if (!domain) {
      throw new AppException(ERROR_CODES.COMPANY_DOMAIN_NOT_FOUND);
    }

    const check = await this.verificationService.check(
      domain.hostname,
      domain.verificationToken,
    );
    const wasActive = domain.status === CompanyDomainStatus.ACTIVE;
    domain.status = nextDomainStatus(domain.status, check);
    domain.lastCheckedAt = new Date();

    if (check.ownership && !domain.verifiedAt) {
      domain.verifiedAt = new Date();
    }

    if (wasActive && domain.status !== CompanyDomainStatus.ACTIVE) {
      await this.publicCache.invalidateHost(domain.hostname);
    }

    return toCompanyDomainResponse(await this.domainRepository.save(domain));
  }

  async delete(auth: AuthPayload, id: string) {
    await this.assertCanManage(auth);
    const domain = await this.domainRepository.findOne({
      where: { id, companyId: auth.companyId },
    });

    if (!domain) {
      throw new AppException(ERROR_CODES.COMPANY_DOMAIN_NOT_FOUND);
    }

    await this.domainRepository.softDelete({ id });
    await this.publicCache.invalidateHost(domain.hostname);

    return { message: 'Domínio removido com sucesso' };
  }
}
