import { entitlementsFor } from 'src/modules/plan/domain/entitlements';
import { CompanyEntity } from '../domain/entities/company.entity';

/** Expects `ENTITLEMENT_RELATIONS` loaded. */
export function toCompanyResponse(company: CompanyEntity) {
  return {
    id: company.id,
    name: company.name,
    email: company.email,
    plan: { code: company.plan.code, name: company.plan.name },
    entitlements: entitlementsFor(company),
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
