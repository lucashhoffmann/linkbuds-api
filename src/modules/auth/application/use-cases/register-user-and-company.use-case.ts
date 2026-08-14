import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { PlanType } from 'src/modules/plan/domain/enums/plan-type.enum';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import {
  ConflictException,
  ForbiddenException,
} from 'src/shared/exceptions/business.exception';
import type { TokenService } from '../ports/token.service';
import { RegisterUserAndCompanyDto } from '../dto/register-user-and-company.dto';

@Injectable()
export class RegisterUserAndCompanyUseCase {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('TokenService') private readonly tokens: TokenService,
  ) {}

  async execute(dto: RegisterUserAndCompanyDto) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();

    return this.dataSource.transaction(async (manager) => {
      const companyRepository = manager.getRepository(CompanyEntity);
      const planRepository = manager.getRepository(PlanEntity);
      const userRepository = manager.getRepository(UserEntity);

      const existingCompany = await companyRepository.findOne({
        where: { email },
      });
      const existingUser = await userRepository.findOne({
        where: { email },
      });

      if (existingCompany || existingUser) {
        throw new ConflictException(ERROR_CODES.USER_EMAIL_ALREADY_EXISTS);
      }

      const freePlan = await planRepository.findOne({
        where: { code: PlanType.FREE, active: true },
      });

      if (!freePlan) {
        throw new ForbiddenException(ERROR_CODES.LINK_PAGE_PLAN_REQUIRED);
      }

      const company = await companyRepository.save(
        companyRepository.create({
          name: dto.companyName?.trim() || `Empresa de ${name}`,
          email,
          planId: freePlan.id,
        }),
      );

      const user = await userRepository.save(
        userRepository.create({
          name,
          email,
          password: await argon2.hash(dto.password),
          company,
        }),
      );

      const payload = {
        id: user.id,
        companyId: company.id,
      };

      return {
        token: this.tokens.signAccess(payload),
        refreshToken: this.tokens.signRefresh(payload),
      };
    });
  }
}
