import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { toCompanyResponse } from './company-response.mapper';

@Injectable()
export class ListCompaniesUseCase {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepository: Repository<CompanyEntity>,
  ) {}

  async execute() {
    const companies = await this.companyRepository.find({
      order: { createdAt: 'DESC' },
    });

    return companies.map(toCompanyResponse);
  }
}
