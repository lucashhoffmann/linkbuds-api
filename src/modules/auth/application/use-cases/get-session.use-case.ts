import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { toCompanyResponse } from 'src/modules/company/application/use-cases/company-response.mapper';
import { toUserResponse } from 'src/modules/user/application/use-cases/user-response.mapper';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { NotFoundException } from 'src/shared/exceptions/business.exception';
import { AuthPayload } from 'src/shared/types/auth-payload.types';

@Injectable()
export class GetSessionUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async execute(auth: AuthPayload) {
    const user = await this.userRepository.findOne({
      where: { id: auth.id, company: { id: auth.companyId } },
      relations: { company: true },
    });

    if (!user) {
      throw new NotFoundException(ERROR_CODES.USER_NOT_FOUND);
    }

    const company = await this.companyRepository.findOne({
      where: { id: auth.companyId },
      relations: { plan: true },
    });

    if (!company) {
      throw new NotFoundException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    return {
      user: toUserResponse(user),
      company: toCompanyResponse(company),
    };
  }
}
