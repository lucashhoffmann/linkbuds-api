import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { Action } from 'src/modules/authorization/domain/enums/action.enum';
import { AuthorizationSubject } from 'src/modules/authorization/domain/enums/authorization-subject.enum';
import { AppAbilityFactory } from 'src/modules/authorization/application/app-ability.factory';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from 'src/shared/exceptions/business.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { CompanyDomainEntity } from '../domain/entities/company-domain.entity';
import { CompanyEntity } from '../domain/entities/company.entity';
import { CompanyDomainStatus } from '../domain/enums/company-domain-status.enum';
import { getCustomDomainCnameTarget } from './company-domain-cname-target';
import { CreateCompanyDomainDto } from './dto/company-domain.dto';
import { DomainVerificationService } from './domain-verification.service';

function normalizeHostname(value: string) {
  const trimmed = value.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
  const hostname = withoutProtocol.split('/')[0]?.replace(/\.$/, '') ?? '';

  return hostname;
}

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
    !(
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error
    )
  ) {
    return null;
  }

  return (
    error as {
      driverError?: { constraint?: string };
    }
  ).driverError?.constraint;
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
    dnsInstructions: {
      type: 'CNAME',
      name: domain.hostname,
      value: cnameTarget,
      verificationToken: domain.verificationToken,
    },
  };
}

@Injectable()
export class CompanyDomainService {
  constructor(
    private readonly abilityFactory: AppAbilityFactory,
    private readonly verificationService: DomainVerificationService,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
    @InjectRepository(CompanyDomainEntity)
    private readonly domainRepository: Repository<CompanyDomainEntity>,
  ) {}

  private async getCompany(auth: AuthPayload) {
    const company = await this.companyRepository.findOne({
      where: { id: auth.companyId },
      relations: { plan: true },
    });

    if (!company) {
      throw new NotFoundException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    return company;
  }

  private async assertCanManage(auth: AuthPayload) {
    const company = await this.getCompany(auth);
    const ability = this.abilityFactory.createForCompany(company);
    this.abilityFactory.assertCan(
      ability,
      Action.ManageCustomDomain,
      AuthorizationSubject.CompanyDomain,
      { companyId: company.id },
    );
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
      throw new ValidationException(
        ERROR_CODES.COMPANY_DOMAIN_INVALID_HOSTNAME,
      );
    }

    const [existingCompanyDomain, existingHostname] = await Promise.all([
      this.domainRepository.findOne({ where: { companyId: auth.companyId } }),
      this.domainRepository.findOne({ where: { hostname } }),
    ]);

    if (existingCompanyDomain) {
      throw new ConflictException(ERROR_CODES.COMPANY_DOMAIN_LIMIT_REACHED);
    }

    if (existingHostname) {
      throw new ConflictException(ERROR_CODES.COMPANY_DOMAIN_ALREADY_EXISTS);
    }

    try {
      const domain = await this.domainRepository.save(
        this.domainRepository.create({
          companyId: auth.companyId,
          hostname,
          status: CompanyDomainStatus.PENDING,
          verificationToken: `linksbuds-${randomBytes(18).toString('hex')}`,
        }),
      );

      return toCompanyDomainResponse(domain);
    } catch (error) {
      const constraint = uniqueConstraintName(error);

      if (
        constraint === 'UQ_company_domains_hostname' ||
        constraint === 'UQ_company_domains_hostname_active'
      ) {
        throw new ConflictException(ERROR_CODES.COMPANY_DOMAIN_ALREADY_EXISTS);
      }

      if (constraint === 'UQ_company_domains_company_active') {
        throw new ConflictException(ERROR_CODES.COMPANY_DOMAIN_LIMIT_REACHED);
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
      throw new NotFoundException(ERROR_CODES.COMPANY_DOMAIN_NOT_FOUND);
    }

    const verified = await this.verificationService.verifyCname(
      domain.hostname,
    );
    domain.lastCheckedAt = new Date();

    if (verified) {
      domain.status = CompanyDomainStatus.ACTIVE;
      domain.verifiedAt = new Date();
    } else if (domain.status === CompanyDomainStatus.ACTIVE) {
      domain.status = CompanyDomainStatus.PENDING;
    }

    return toCompanyDomainResponse(await this.domainRepository.save(domain));
  }

  async delete(auth: AuthPayload, id: string) {
    await this.assertCanManage(auth);
    const result = await this.domainRepository.softDelete({
      id,
      companyId: auth.companyId,
    });

    if (!result.affected) {
      throw new NotFoundException(ERROR_CODES.COMPANY_DOMAIN_NOT_FOUND);
    }

    return { message: 'Domínio removido com sucesso' };
  }
}
