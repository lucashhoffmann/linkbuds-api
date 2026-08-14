import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  MongoAbility,
  createMongoAbility,
  subject,
} from '@casl/ability';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { PlanType } from 'src/modules/plan/domain/enums/plan-type.enum';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { ForbiddenException } from 'src/shared/exceptions/business.exception';
import { Action } from '../domain/enums/action.enum';
import { AuthorizationSubject } from '../domain/enums/authorization-subject.enum';

export type AppAbility = MongoAbility<[Action, any]>;

type CompanyWithPlan = Pick<CompanyEntity, 'id' | 'plan'>;

function hasCustomDomainAccess(company: CompanyWithPlan) {
  return (
    company.plan?.customDomainEnabled ||
    company.plan?.type === PlanType.FREE ||
    company.plan?.type === PlanType.AGENCY ||
    company.plan?.type === PlanType.CUSTOM
  );
}

@Injectable()
export class AppAbilityFactory {
  createForCompany(company: CompanyWithPlan): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const companyCondition = { companyId: company.id };

    can(
      [Action.Create, Action.Read, Action.Update, Action.Delete, Action.Manage],
      AuthorizationSubject.LinkPage,
      companyCondition,
    );

    if (
      company.plan?.analyticsEnabled ||
      company.plan?.type === PlanType.AGENCY ||
      company.plan?.type === PlanType.CUSTOM
    ) {
      can(
        Action.ViewAnalytics,
        AuthorizationSubject.LinkPageAnalytics,
        companyCondition,
      );
    }

    if (hasCustomDomainAccess(company)) {
      can(
        Action.ManageCustomDomain,
        AuthorizationSubject.CompanyDomain,
        companyCondition,
      );
    }

    if (company.plan?.whiteLabelEnabled) {
      can(
        Action.ManageWhiteLabel,
        AuthorizationSubject.LinkPageWhiteLabel,
        companyCondition,
      );
    }

    return build();
  }

  assertCan(
    ability: AppAbility,
    action: Action,
    authorizationSubject: AuthorizationSubject,
    resource: Record<string, unknown>,
  ) {
    if (!ability.can(action, subject(authorizationSubject, resource))) {
      throw new ForbiddenException(ERROR_CODES.LINK_PAGE_FEATURE_FORBIDDEN);
    }
  }
}
