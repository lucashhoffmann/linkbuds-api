import { CompanyEntity } from '../../domain/entities/company.entity';
import { PlanType } from 'src/modules/plan/domain/enums/plan-type.enum';

function analyticsTierForPlan(plan: CompanyEntity['plan']) {
  if (plan?.type === PlanType.AGENCY || plan?.type === PlanType.CUSTOM) {
    return 'FULL';
  }

  return 'BASIC';
}

export function toCompanyResponse(company: CompanyEntity) {
  return {
    id: company.id,
    name: company.name,
    email: company.email,
    plan: company.plan
      ? {
          id: company.plan.id,
          name: company.plan.name,
          code: company.plan.code,
          type: company.plan.type,
          maxClientPages: company.plan.maxClientPages,
          priceCents: company.plan.priceCents,
          active: company.plan.active,
          analyticsEnabled: company.plan.analyticsEnabled,
          analyticsTier: analyticsTierForPlan(company.plan),
          customDomainEnabled: company.plan.customDomainEnabled,
          whiteLabelEnabled: company.plan.whiteLabelEnabled,
        }
      : null,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    deletedAt: company.deletedAt,
  };
}
