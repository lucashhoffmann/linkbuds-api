import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanEntity } from '../../domain/entities/plan.entity';

// ponytail: single yearly discount for every plan; move to `plans` when billing needs per-plan cycles.
export const YEARLY_DISCOUNT_PERCENT = 25;

export type PricingPlanResponse = {
  code: string;
  name: string;
  label: string;
  description: string;
  maxClientPages: number | null;
  priceCents: number | null;
  priceLabel: string | null;
  features: string[];
  action: string;
  featured: boolean;
  custom: boolean;
};

export type PricingPlansResponse = {
  yearlyDiscountPercent: number;
  plans: PricingPlanResponse[];
};

/** Special conditions are granted per company, never self-served: only a contact card. */
const CUSTOM_CARD: PricingPlanResponse = {
  code: 'CUSTOM',
  name: 'Personalizado',
  label: 'Sob medida',
  description: 'Condições especiais para agências que precisam ir além.',
  maxClientPages: null,
  priceCents: null,
  priceLabel: 'Sob consulta',
  features: [
    'Tudo do Agência',
    'Limite de clientes sob medida',
    'Condição comercial dedicada',
    'Suporte prioritário',
  ],
  action: 'Criar conta e solicitar',
  featured: false,
  custom: true,
};

@Injectable()
export class GetPricingPlansUseCase {
  constructor(
    @InjectRepository(PlanEntity)
    private readonly planRepository: Repository<PlanEntity>,
  ) {}

  async execute(): Promise<PricingPlansResponse> {
    const plans = await this.planRepository.find({
      where: { public: true, active: true },
      order: { sortOrder: 'ASC' },
    });

    return {
      yearlyDiscountPercent: YEARLY_DISCOUNT_PERCENT,
      plans: [
        ...plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          label: plan.label,
          description: plan.description,
          maxClientPages: plan.maxClientPages,
          priceCents: plan.priceCents,
          priceLabel: null,
          features: plan.features,
          action: plan.actionLabel,
          featured: plan.featured,
          custom: false,
        })),
        CUSTOM_CARD,
      ],
    };
  }
}
