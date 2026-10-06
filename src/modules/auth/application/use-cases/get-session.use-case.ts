import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toCompanyResponse } from 'src/modules/company/application/company-response.mapper';
import { ENTITLEMENT_RELATIONS } from 'src/modules/plan/domain/entitlements';
import { toUserResponse } from 'src/modules/user/application/user-response.mapper';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import { AuthPayload } from 'src/shared/types/auth-payload.types';

@Injectable()
export class GetSessionUseCase {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async execute(auth: AuthPayload) {
    const user = await this.userRepository.findOne({
      where: { id: auth.id, companyId: auth.companyId },
      relations: { identity: true, company: ENTITLEMENT_RELATIONS },
    });

    if (!user) {
      throw new AppException(ERROR_CODES.USER_NOT_FOUND);
    }

    return {
      user: toUserResponse(user),
      company: toCompanyResponse(user.company),
    };
  }
}
