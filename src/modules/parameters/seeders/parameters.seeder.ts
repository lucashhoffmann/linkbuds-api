import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PRICING_PLANS_CATALOG_DESCRIPTION,
  PRICING_PLANS_CATALOG_FEATURE,
  PRICING_PLANS_CATALOG_PAYLOAD,
} from '../constants/pricing-plans-catalog.constant';
import { ParameterEntity } from '../domain/entities/parameter.entity';

@Injectable()
export class ParametersSeeder implements OnModuleInit {
  constructor(
    @InjectRepository(ParameterEntity)
    private readonly parametersRepository: Repository<ParameterEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  async seedDefaults(): Promise<void> {
    await this.parametersRepository
      .createQueryBuilder()
      .insert()
      .into(ParameterEntity)
      .values({
        feature: PRICING_PLANS_CATALOG_FEATURE,
        description: PRICING_PLANS_CATALOG_DESCRIPTION,
        isActive: true,
        payload: PRICING_PLANS_CATALOG_PAYLOAD,
      })
      .orIgnore()
      .execute();
  }
}
