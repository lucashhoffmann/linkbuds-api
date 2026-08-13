import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEntity } from '../domain/entities/plan.entity';
import { PlanType } from '../domain/enums/plan-type.enum';

export const DEFAULT_STANDARD_PLANS: Array<Partial<PlanEntity>> = [
  {
    name: 'Agency 20',
    code: 'AGENCY_20',
    type: PlanType.STANDARD,
    maxClientPages: 20,
    priceCents: 18000,
    companyId: null,
    active: true,
  },
];

@Injectable()
export class PlansSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(PlanEntity)
    private readonly plansRepository: Repository<PlanEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  async seedDefaults(): Promise<void> {
    await this.plansRepository.upsert(DEFAULT_STANDARD_PLANS, ['code']);
  }
}
