import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { ConflictException } from 'src/shared/exceptions/business.exception';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { toCompanyResponse } from './company-response.mapper';

@Injectable()
export class CreateCompanyUseCase {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async execute(dto: CreateCompanyDto) {
    const email = dto.email.trim().toLowerCase();
    const existingCompany = await this.companyRepository.findOne({
      where: { email },
    });

    if (existingCompany) {
      throw new ConflictException(ERROR_CODES.COMPANY_ALREADY_EXISTS);
    }

    const company = this.companyRepository.create({
      name: dto.name.trim(),
      email,
    });

    return toCompanyResponse(await this.companyRepository.save(company));
  }
}
