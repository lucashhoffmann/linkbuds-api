import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PRICING_PLANS_CATALOG_FEATURE,
  PRICING_PLANS_CATALOG_PAYLOAD,
  type PricingPlansCatalogPayload,
} from 'src/modules/parameters/constants/pricing-plans-catalog.constant';
import { ParameterEntity } from 'src/modules/parameters/domain/entities/parameter.entity';
import { PlanType } from '../../domain/enums/plan-type.enum';

type PricingPlanResponseType = 'FREE' | 'AGENCY' | 'CUSTOM';

export type PricingPlanResponse = {
  code: PricingPlanResponseType;
  type: PricingPlanResponseType;
  name: string;
  label: string;
  description: string;
  maxClientPages: number | null;
  priceCents: number | null;
  priceLabel: string | null;
  features: string[];
  action: string;
  active: boolean;
  featured: boolean;
  custom: boolean;
};

export type PricingPlansResponse = {
  yearlyDiscountPercent: number;
  custom: PricingPlansCatalogPayload['custom'];
  plans: PricingPlanResponse[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function integerOrDefault(value: unknown, defaultValue: number): number {
  return Number.isInteger(value) ? (value as number) : defaultValue;
}

function booleanOrDefault(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

function normalizeCatalogPayload(
  payload: Record<string, unknown> | null,
): PricingPlansCatalogPayload {
  if (!isRecord(payload)) {
    return PRICING_PLANS_CATALOG_PAYLOAD;
  }

  const payloadPlans = isRecord(payload.plans) ? payload.plans : {};
  const freePlan = isRecord(payloadPlans.FREE) ? payloadPlans.FREE : {};
  const agencyPlan = isRecord(payloadPlans.AGENCY) ? payloadPlans.AGENCY : {};
  const custom = isRecord(payload.custom) ? payload.custom : {};

  return {
    yearlyDiscountPercent: integerOrDefault(
      payload.yearlyDiscountPercent,
      PRICING_PLANS_CATALOG_PAYLOAD.yearlyDiscountPercent,
    ),
    plans: {
      FREE: {
        active: booleanOrDefault(
          freePlan.active,
          PRICING_PLANS_CATALOG_PAYLOAD.plans.FREE.active,
        ),
        maxClientPages: integerOrDefault(
          freePlan.maxClientPages,
          PRICING_PLANS_CATALOG_PAYLOAD.plans.FREE.maxClientPages,
        ),
        priceCents: integerOrDefault(
          freePlan.priceCents,
          PRICING_PLANS_CATALOG_PAYLOAD.plans.FREE.priceCents,
        ),
      },
      AGENCY: {
        active: booleanOrDefault(
          agencyPlan.active,
          PRICING_PLANS_CATALOG_PAYLOAD.plans.AGENCY.active,
        ),
        maxClientPages: integerOrDefault(
          agencyPlan.maxClientPages,
          PRICING_PLANS_CATALOG_PAYLOAD.plans.AGENCY.maxClientPages,
        ),
        priceCents: integerOrDefault(
          agencyPlan.priceCents,
          PRICING_PLANS_CATALOG_PAYLOAD.plans.AGENCY.priceCents,
        ),
      },
    },
    custom: {
      active: booleanOrDefault(
        custom.active,
        PRICING_PLANS_CATALOG_PAYLOAD.custom.active,
      ),
      minClientPages: integerOrDefault(
        custom.minClientPages,
        PRICING_PLANS_CATALOG_PAYLOAD.custom.minClientPages,
      ),
      consultationMinClientPages: integerOrDefault(
        custom.consultationMinClientPages,
        PRICING_PLANS_CATALOG_PAYLOAD.custom.consultationMinClientPages,
      ),
      baseUnitPriceCents: integerOrDefault(
        custom.baseUnitPriceCents,
        PRICING_PLANS_CATALOG_PAYLOAD.custom.baseUnitPriceCents,
      ),
      stepClientPages: integerOrDefault(
        custom.stepClientPages,
        PRICING_PLANS_CATALOG_PAYLOAD.custom.stepClientPages,
      ),
      stepIncrementCents: integerOrDefault(
        custom.stepIncrementCents,
        PRICING_PLANS_CATALOG_PAYLOAD.custom.stepIncrementCents,
      ),
    },
  };
}

@Injectable()
export class GetPricingPlansUseCase {
  constructor(
    @InjectRepository(ParameterEntity)
    private readonly parametersRepository: Repository<ParameterEntity>,
  ) {}

  async execute(): Promise<PricingPlansResponse> {
    const parameter = await this.parametersRepository.findOne({
      where: { feature: PRICING_PLANS_CATALOG_FEATURE, isActive: true },
    });

    const catalog = normalizeCatalogPayload(parameter?.payload ?? null);
    const plans: PricingPlanResponse[] = [
      {
        code: PlanType.FREE,
        type: PlanType.FREE,
        name: 'Gratis',
        label: 'Inicial',
        description: 'Comece a criar sua presença digital com o Linkbuds.',
        active: catalog.plans.FREE.active,
        maxClientPages: catalog.plans.FREE.maxClientPages,
        priceCents: catalog.plans.FREE.priceCents,
        priceLabel: null,
        features: [
          '1 pagina para sua agencia',
          `${catalog.plans.FREE.maxClientPages} pagina de cliente`,
          'Links ilimitados',
          'Personalizacao da pagina',
          'Metricas basicas de acessos',
          'QR Code da pagina',
        ],
        action: 'Comecar gratis',
        featured: false,
        custom: false,
      },
      {
        code: PlanType.AGENCY,
        type: PlanType.AGENCY,
        name: 'Agencia',
        label: 'Padrao',
        description:
          'Gerencie paginas profissionais para seus clientes em um so lugar.',
        active: catalog.plans.AGENCY.active,
        maxClientPages: catalog.plans.AGENCY.maxClientPages,
        priceCents: catalog.plans.AGENCY.priceCents,
        priceLabel: null,
        features: [
          '1 pagina para sua agencia',
          `Ate ${catalog.plans.AGENCY.maxClientPages} paginas de clientes`,
          'Metricas detalhadas de acessos',
          'Tracking de cliques e conversoes',
          'Analytics',
          'Dominio personalizado',
          'Remocao da marca Linkbuds',
        ],
        action: 'Assinar Agencia',
        featured: true,
        custom: false,
      },
      {
        code: PlanType.CUSTOM,
        type: PlanType.CUSTOM,
        name: 'Customizado',
        label: 'Sob medida',
        description:
          'Um plano personalizado para agencias que precisam ir alem.',
        active: catalog.custom.active,
        maxClientPages: null,
        priceCents: null,
        priceLabel: 'Sob consulta',
        features: [
          'Tudo do Agencia',
          `A partir de ${catalog.custom.minClientPages} paginas de clientes`,
          'Limite personalizado para sua agencia',
          'Metricas avancadas',
          'Tracking avancado',
          'Dominio personalizado',
          'Suporte prioritario',
        ],
        action: 'Criar meu plano',
        featured: false,
        custom: true,
      },
    ];

    return {
      yearlyDiscountPercent: catalog.yearlyDiscountPercent,
      custom: catalog.custom,
      plans: plans.filter((plan) => plan.active),
    };
  }
}
