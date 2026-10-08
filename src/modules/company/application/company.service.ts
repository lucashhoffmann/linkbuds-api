import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { CompanyEntity } from '../domain/entities/company.entity';
import { UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async update(auth: AuthPayload, dto: UpdateCompanyDto) {
    if (auth.role !== UserRole.OWNER) {
      throw new AppException(ERROR_CODES.COMPANY_OWNER_REQUIRED);
    }

    await this.companyRepository.update({ id: auth.companyId }, dto);
    return { id: auth.companyId, name: dto.name };
  }
}
