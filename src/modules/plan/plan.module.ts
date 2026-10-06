import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from '../company/domain/entities/company.entity';
import { CompanyConditionsService } from './application/company-conditions.service';
import { GetPricingPlansUseCase } from './application/use-cases/get-pricing-plans.use-case';
import { CompanyConditionEntity } from './domain/entities/company-condition.entity';
import { PlanEntity } from './domain/entities/plan.entity';
import { AdminConditionsController } from './presentation/admin-conditions.controller';
import { PricingPlansController } from './presentation/pricing-plans.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanEntity,
      CompanyConditionEntity,
      CompanyEntity,
    ]),
  ],
  controllers: [PricingPlansController, AdminConditionsController],
  providers: [GetPricingPlansUseCase, CompanyConditionsService],
})
export class PlanModule {}
