import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEntity } from '../domain/entities/plan.entity';
import { PlanType } from '../domain/enums/plan-type.enum';

export const DEFAULT_PUBLIC_PLANS: Array<Partial<PlanEntity>> = [
  {
    name: 'Free',
    code: 'FREE',
    type: PlanType.FREE,
    maxClientPages: 1,
    priceCents: 0,
    companyId: null,
    active: true,
    analyticsEnabled: true,
    customDomainEnabled: true,
    whiteLabelEnabled: false,
  },
  {
    name: 'Agency',
    code: 'AGENCY',
    type: PlanType.AGENCY,
    maxClientPages: 20,
    priceCents: 18000,
    companyId: null,
    active: true,
    analyticsEnabled: true,
    customDomainEnabled: true,
    whiteLabelEnabled: true,
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
    await this.plansRepository.upsert(DEFAULT_PUBLIC_PLANS, ['code']);
  }
}
