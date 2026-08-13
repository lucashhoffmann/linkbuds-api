import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanEntity } from './domain/entities/plan.entity';
import { PlansSeeder } from './seeders/plans.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity])],
  providers: [PlansSeeder],
})
export class PlanModule {}
