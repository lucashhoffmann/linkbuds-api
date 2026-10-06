import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { DEFAULT_PLAN_CODE } from 'src/modules/plan/domain/entitlements';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import { getBetterAuth } from '../../infra/better-auth.config';
import {
  acceptInvite,
  assertInviteEmail,
  findValidInvite,
} from 'src/modules/team/application/invite-token';
import { provisionAccount } from '../provision-account';
import { RegisterUserAndCompanyDto } from '../dto/register-user-and-company.dto';

const DUPLICATE_USER_CODES = [
  'USER_ALREADY_EXISTS',
  'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
];

function isDuplicateUserError(error: unknown) {
  const code = (error as { body?: { code?: string } } | null)?.body?.code;

  return Boolean(code && DUPLICATE_USER_CODES.includes(code));
}

@Injectable()
export class RegisterUserAndCompanyUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(dto: RegisterUserAndCompanyDto) {
    const email = dto.email.trim().toLowerCase();

    // Fail before creating the credential when sign-up is impossible.
    if (dto.inviteToken) {
      assertInviteEmail(
        await findValidInvite(this.dataSource.manager, dto.inviteToken),
        email,
      );
    } else {
      await this.assertDefaultPlan();
    }

    const user = await this.signUp(dto.name.trim(), email, dto.password);

    if (dto.inviteToken) {
      await acceptInvite(this.dataSource, user, dto.inviteToken);
    } else {
      // If this fails, AuthGuard provisions the account on first login.
      await provisionAccount(this.dataSource, user, dto.companyName);
    }

    return { ok: true };
  }

  private async assertDefaultPlan() {
    const freePlan = await this.dataSource.getRepository(PlanEntity).findOne({
      where: { code: DEFAULT_PLAN_CODE, active: true },
    });

    if (!freePlan) {
      throw new AppException(ERROR_CODES.LINK_PAGE_PLAN_REQUIRED);
    }
  }

  private async signUp(name: string, email: string, password: string) {
    const auth = await getBetterAuth();
    const { user } = await auth.api
      .signUpEmail({ body: { name, email, password } })
      .catch((error: unknown) => {
        if (isDuplicateUserError(error)) {
          throw new AppException(ERROR_CODES.USER_EMAIL_ALREADY_EXISTS);
        }

        throw error;
      });

    return user;
  }
}
