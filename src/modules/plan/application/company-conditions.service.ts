import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import { CompanyConditionEntity } from '../domain/entities/company-condition.entity';
import { PlanEntity } from '../domain/entities/plan.entity';
import {
  ENTITLEMENT_RELATIONS,
  activeCondition,
  entitlementsFor,
} from '../domain/entitlements';
import { CreateCompanyConditionDto } from './dto/company-condition.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

type ConditionStatus =
  'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'REVOKED' | 'SUPERSEDED';

function conditionStatus(
  condition: CompanyConditionEntity,
  active: CompanyConditionEntity | null,
  now: Date,
): ConditionStatus {
  if (condition.deletedAt) return 'REVOKED';
  if (condition.startsAt > now) return 'SCHEDULED';
  if (condition.endsAt && condition.endsAt <= now) return 'EXPIRED';
  return condition.id === active?.id ? 'ACTIVE' : 'SUPERSEDED';
}

/** Internal (admin) management of special conditions — the "CUSTOM" plan. */
@Injectable()
export class CompanyConditionsService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
    @InjectRepository(CompanyConditionEntity)
    private readonly conditionRepository: Repository<CompanyConditionEntity>,
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {}

  listPlans() {
    return this.planRepository.find({ order: { sortOrder: 'ASC' } });
  }

  async createPlan(dto: CreatePlanDto) {
    if (await this.planRepository.existsBy({ code: dto.code })) {
      throw new AppException(ERROR_CODES.PLAN_ALREADY_EXISTS);
    }

    return this.planRepository.save(this.planRepository.create(dto));
  }

  /** Changes apply immediately to every company on this plan. */
  async updatePlan(code: string, dto: UpdatePlanDto) {
    const plan = await this.planRepository.findOne({ where: { code } });

    if (!plan) {
      throw new AppException(ERROR_CODES.PLAN_NOT_FOUND);
    }

    return this.planRepository.save(Object.assign(plan, dto));
  }

  async searchCompanies(q: string) {
    const companies = await this.companyRepository.find({
      where: [{ name: ILike(`%${q}%`) }, { email: ILike(`%${q}%`) }],
      relations: ENTITLEMENT_RELATIONS,
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      email: company.email,
      plan: company.plan.code,
      entitlements: entitlementsFor(company),
    }));
  }

  /** Company with its current entitlements and full condition history. */
  async getCompany(companyId: string, now = new Date()) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
      relations: { plan: true },
    });

    if (!company) {
      throw new AppException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    company.conditions = await this.conditionRepository.find({
      where: { companyId },
      relations: { plan: true },
      withDeleted: true,
      order: { createdAt: 'DESC' },
    });
    const active = activeCondition(company.conditions, now);

    return {
      id: company.id,
      name: company.name,
      email: company.email,
      plan: company.plan.code,
      entitlements: entitlementsFor(company, now),
      conditions: company.conditions.map((condition) => ({
        id: condition.id,
        status: conditionStatus(condition, active, now),
        planCode: condition.plan?.code ?? null,
        maxClientPages: condition.maxClientPages,
        maxMembers: condition.maxMembers,
        priceCents: condition.priceCents,
        discountPercent: condition.discountPercent,
        analyticsTier: condition.analyticsTier,
        customDomain: condition.customDomain,
        whiteLabel: condition.whiteLabel,
        note: condition.note,
        startsAt: condition.startsAt,
        endsAt: condition.endsAt,
        createdAt: condition.createdAt,
        revokedAt: condition.deletedAt,
      })),
    };
  }

  async create(companyId: string, dto: CreateCompanyConditionDto) {
    const companyExists = await this.companyRepository.existsBy({
      id: companyId,
    });

    if (!companyExists) {
      throw new AppException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    let planId: string | null = null;

    if (dto.planCode) {
      const plan = await this.planRepository.findOne({
        where: { code: dto.planCode },
      });

      if (!plan) {
        throw new AppException(ERROR_CODES.PLAN_NOT_FOUND);
      }

      planId = plan.id;
    }

    await this.conditionRepository.save(
      this.conditionRepository.create({
        companyId,
        planId,
        maxClientPages: dto.maxClientPages ?? null,
        maxMembers: dto.maxMembers ?? null,
        priceCents: dto.priceCents ?? null,
        discountPercent: dto.discountPercent ?? null,
        analyticsTier: dto.analyticsTier ?? null,
        customDomain: dto.customDomain ?? null,
        whiteLabel: dto.whiteLabel ?? null,
        note: dto.note ?? null,
        startsAt: dto.startsAt ?? new Date(),
        endsAt: dto.endsAt ?? null,
      }),
    );

    return this.getCompany(companyId);
  }

  /** Soft delete: stays in the history as REVOKED. */
  async revoke(conditionId: string) {
    const condition = await this.conditionRepository.findOne({
      where: { id: conditionId },
    });

    if (!condition) {
      throw new AppException(ERROR_CODES.COMPANY_CONDITION_NOT_FOUND);
    }

    await this.conditionRepository.softDelete({ id: conditionId });

    return this.getCompany(condition.companyId);
  }
}
