import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/domain/entities/user.entity';
import { CreateCompanyUseCase } from './application/use-cases/create-company.use-case';
import { DeleteCompanyUseCase } from './application/use-cases/delete-company.use-case';
import { GetCompanyUseCase } from './application/use-cases/get-company.use-case';
import { ListCompaniesUseCase } from './application/use-cases/list-companies.use-case';
import { UpdateCompanyUseCase } from './application/use-cases/update-company.use-case';
import { CompanyEntity } from './domain/entities/company.entity';
import { CompanyController } from './presentation/company.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity, UserEntity])],
  controllers: [CompanyController],
  providers: [
    CreateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    UpdateCompanyUseCase,
    DeleteCompanyUseCase,
  ],
  exports: [
    CreateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    UpdateCompanyUseCase,
    DeleteCompanyUseCase,
  ],
})
export class CompanyModule {}
