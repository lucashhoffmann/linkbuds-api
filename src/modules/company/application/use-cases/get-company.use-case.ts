import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { NotFoundException } from 'src/shared/exceptions/business.exception';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { toCompanyResponse } from './company-response.mapper';

@Injectable()
export class GetCompanyUseCase {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async execute(id: string) {
    const company = await this.companyRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    return toCompanyResponse(company);
  }
}
