import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TransformResponseInterceptor } from 'src/shared/interceptors';
import { GetPricingPlansUseCase } from '../application/use-cases/get-pricing-plans.use-case';

@Controller('pricing-plans')
@UseInterceptors(TransformResponseInterceptor)
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class PricingPlansController {
  constructor(
    private readonly getPricingPlansUseCase: GetPricingPlansUseCase,
  ) {}

  @Get()
  getPricingPlans() {
    return this.getPricingPlansUseCase.execute();
  }
}
