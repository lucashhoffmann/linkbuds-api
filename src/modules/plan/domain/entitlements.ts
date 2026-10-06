import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { CompanyConditionEntity } from './entities/company-condition.entity';
import type { PlanEntity } from './entities/plan.entity';

export type AnalyticsTier = 'BASIC' | 'FULL';

export const DEFAULT_PLAN_CODE = 'FREE';

export interface Entitlements {
  planCode: string;
  maxClientPages: number;
  maxMembers: number;
  maxForms: number;
  analyticsTier: AnalyticsTier;
  customDomain: boolean;
  whiteLabel: boolean;
  /** True when a special condition is shaping these values. */
  custom: boolean;
}

type FeatureEntitlement = 'customDomain' | 'whiteLabel';

export interface CompanyWithPlan {
  plan: PlanEntity;
  conditions?: CompanyConditionEntity[];
}

/** Relations to load on CompanyEntity before calling `entitlementsFor`. */
export const ENTITLEMENT_RELATIONS = {
  plan: true,
  conditions: { plan: true },
} as const;

export function activeCondition(
  conditions: CompanyConditionEntity[] = [],
  now = new Date(),
): CompanyConditionEntity | null {
  return (
    conditions
      .filter(
        (condition) =>
          !condition.deletedAt &&
          condition.startsAt <= now &&
          (!condition.endsAt || condition.endsAt > now),
      )
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0] ?? null
  );
}

/** Single source of truth for what a company can use: plan ⊕ active condition. */
export function entitlementsFor(
  company: CompanyWithPlan,
  now = new Date(),
): Entitlements {
  const condition = activeCondition(company.conditions, now);
  const plan = condition?.plan ?? company.plan;

  return {
    planCode: plan.code,
    maxClientPages: condition?.maxClientPages ?? plan.maxClientPages,
    maxMembers: condition?.maxMembers ?? plan.maxMembers,
    maxForms: condition?.maxForms ?? plan.maxForms,
    analyticsTier: condition?.analyticsTier ?? plan.analyticsTier,
    customDomain: condition?.customDomain ?? plan.customDomain,
    whiteLabel: condition?.whiteLabel ?? plan.whiteLabel,
    custom: Boolean(condition),
  };
}

export function assertEntitled(
  company: CompanyWithPlan,
  feature: FeatureEntitlement,
) {
  if (!entitlementsFor(company)[feature]) {
    throw new AppException(ERROR_CODES.LINK_PAGE_FEATURE_FORBIDDEN);
  }
}
