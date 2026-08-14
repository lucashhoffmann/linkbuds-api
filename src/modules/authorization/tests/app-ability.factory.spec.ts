import { subject } from '@casl/ability';
import { PlanType } from 'src/modules/plan/domain/enums/plan-type.enum';
import { AppAbilityFactory } from '../application/app-ability.factory';
import { Action } from '../domain/enums/action.enum';
import { AuthorizationSubject } from '../domain/enums/authorization-subject.enum';

describe('AppAbilityFactory', () => {
  it('allows free plans to manage custom domains without enabling white-label', () => {
    const ability = new AppAbilityFactory().createForCompany({
      id: 'company-id',
      plan: {
        type: PlanType.FREE,
        customDomainEnabled: false,
        whiteLabelEnabled: false,
      },
    } as never);

    expect(
      ability.can(
        Action.ManageCustomDomain,
        subject(AuthorizationSubject.CompanyDomain, {
          companyId: 'company-id',
        }),
      ),
    ).toBe(true);
    expect(
      ability.can(
        Action.ManageWhiteLabel,
        subject(AuthorizationSubject.LinkPageWhiteLabel, {
          companyId: 'company-id',
        }),
      ),
    ).toBe(false);
  });
});
