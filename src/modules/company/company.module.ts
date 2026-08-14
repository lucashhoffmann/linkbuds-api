import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserEntity } from '../user/domain/entities/user.entity';
import { CompanyDomainService } from './application/company-domain.service';
import { CreateCompanyUseCase } from './application/use-cases/create-company.use-case';
import { DeleteCompanyUseCase } from './application/use-cases/delete-company.use-case';
import { DomainVerificationService } from './application/domain-verification.service';
import { GetCompanyUseCase } from './application/use-cases/get-company.use-case';
import { ListCompaniesUseCase } from './application/use-cases/list-companies.use-case';
import { UpdateCompanyUseCase } from './application/use-cases/update-company.use-case';
import { CompanyDomainEntity } from './domain/entities/company-domain.entity';
import { CompanyEntity } from './domain/entities/company.entity';
import { CompanyController } from './presentation/company.controller';
import { CompanyDomainController } from './presentation/company-domain.controller';

@Module({
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([CompanyEntity, CompanyDomainEntity, UserEntity]),
  ],
  controllers: [CompanyController, CompanyDomainController],
  providers: [
    CompanyDomainService,
    DomainVerificationService,
    CreateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    UpdateCompanyUseCase,
    DeleteCompanyUseCase,
  ],
  exports: [
    CompanyDomainService,
    CreateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    UpdateCompanyUseCase,
    DeleteCompanyUseCase,
  ],
})
export class CompanyModule {}
