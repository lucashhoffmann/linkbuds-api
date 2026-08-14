import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParameterEntity } from '../parameters/domain/entities/parameter.entity';
import { GetPricingPlansUseCase } from './application/use-cases/get-pricing-plans.use-case';
import { PlanEntity } from './domain/entities/plan.entity';
import { PricingPlansController } from './presentation/pricing-plans.controller';
import { PlansSeeder } from './seeders/plans.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity, ParameterEntity])],
  controllers: [PricingPlansController],
  providers: [PlansSeeder, GetPricingPlansUseCase],
})
export class PlanModule {}
