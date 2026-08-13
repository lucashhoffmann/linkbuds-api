import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import {
  ConflictException,
  NotFoundException,
} from 'src/shared/exceptions/business.exception';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import { toCompanyResponse } from './company-response.mapper';

@Injectable()
export class UpdateCompanyUseCase {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async execute(id: string, dto: UpdateCompanyDto) {
    const company = await this.companyRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(ERROR_CODES.COMPANY_NOT_FOUND);
    }

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const companyWithEmail = await this.companyRepository.findOne({
        where: { email },
      });

      if (companyWithEmail && companyWithEmail.id !== company.id) {
        throw new ConflictException(ERROR_CODES.COMPANY_ALREADY_EXISTS);
      }

      company.email = email;
    }

    if (dto.name) {
      company.name = dto.name.trim();
    }

    return toCompanyResponse(await this.companyRepository.save(company));
  }
}
