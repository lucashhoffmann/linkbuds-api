import { z } from 'zod';

const OVERRIDE_KEYS = [
  'planCode',
  'maxClientPages',
  'maxMembers',
  'maxForms',
  'priceCents',
  'discountPercent',
  'analyticsTier',
  'customDomain',
  'whiteLabel',
] as const;

export const createCompanyConditionDto = z
  .object({
    /** Replaces the company plan while active (e.g. "AGENCY"). */
    planCode: z.string().trim().min(1).optional(),
    maxClientPages: z.number().int().min(0).optional(),
    maxMembers: z.number().int().min(1).optional(),
    maxForms: z.number().int().min(0).optional(),
    priceCents: z.number().int().min(0).optional(),
    discountPercent: z.number().int().min(0).max(100).optional(),
    analyticsTier: z.enum(['BASIC', 'FULL']).optional(),
    customDomain: z.boolean().optional(),
    whiteLabel: z.boolean().optional(),
    note: z.string().trim().max(500).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
  })
  .refine((data) => OVERRIDE_KEYS.some((key) => data[key] !== undefined), {
    message:
      'Informe ao menos um ajuste (plano, cota, preço, desconto ou recurso)',
  })
  .refine(
    (data) => !data.endsAt || data.endsAt > (data.startsAt ?? new Date()),
    { message: 'endsAt deve ser posterior a startsAt', path: ['endsAt'] },
  );

export type CreateCompanyConditionDto = z.infer<
  typeof createCompanyConditionDto
>;

export const searchCompaniesDto = z.object({
  q: z.string().trim().min(2).max(120),
});
