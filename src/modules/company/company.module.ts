import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkPageModule } from '../link-page/link-page.module';
import { UserEntity } from '../user/domain/entities/user.entity';
import { CompanyDomainService } from './application/company-domain.service';
import { DomainVerificationService } from './application/domain-verification.service';
import { CompanyDomainEntity } from './domain/entities/company-domain.entity';
import { CompanyEntity } from './domain/entities/company.entity';
import { CompanyDomainController } from './presentation/company-domain.controller';
import { CompanyController } from './presentation/company.controller';
import { CompanyService } from './application/company.service';

@Module({
  imports: [
    LinkPageModule,
    TypeOrmModule.forFeature([CompanyEntity, CompanyDomainEntity, UserEntity]),
  ],
  controllers: [CompanyController, CompanyDomainController],
  providers: [CompanyService, CompanyDomainService, DomainVerificationService],
  exports: [CompanyDomainService],
})
export class CompanyModule {}
