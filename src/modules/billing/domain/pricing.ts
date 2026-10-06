import type { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import {
  type CompanyWithPlan,
  activeCondition,
} from 'src/modules/plan/domain/entitlements';
import { YEARLY_DISCOUNT_PERCENT } from 'src/modules/plan/application/use-cases/get-pricing-plans.use-case';
import type { BillingCycle } from './entities/subscription.entity';

const applyPercentOff = (cents: number, percent: number) =>
  Math.round((cents * (100 - percent)) / 100);

/**
 * What the company pays for `plan` in `cycle`: an active special condition
 * can set a price (for its own plan) and a discount (any plan).
 */
export function priceFor(
  company: CompanyWithPlan,
  plan: PlanEntity,
  cycle: BillingCycle,
  now = new Date(),
): number {
  const condition = activeCondition(company.conditions, now);
  const conditionPlanId = condition?.planId ?? company.plan.id;
  const base =
    condition?.priceCents != null && conditionPlanId === plan.id
      ? condition.priceCents
      : plan.priceCents;
  const monthly = applyPercentOff(base, condition?.discountPercent ?? 0);

  return cycle === 'YEARLY'
    ? applyPercentOff(monthly * 12, YEARLY_DISCOUNT_PERCENT)
    : monthly;
}
