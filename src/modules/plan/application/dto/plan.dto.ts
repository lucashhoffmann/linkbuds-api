import { z } from 'zod';

export const createPlanDto = z.object({
  code: z
    .string()
    .trim()
    .regex(
      /^[A-Z0-9_]{2,80}$/,
      'Use MAIÚSCULAS, números e _ (ex.: AGENCY_PRO)',
    ),
  name: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1),
  features: z.array(z.string().trim().min(1)).default([]),
  actionLabel: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0),
  maxClientPages: z.number().int().min(0),
  maxMembers: z.number().int().min(1),
  maxForms: z.number().int().min(0),
  analyticsTier: z.enum(['BASIC', 'FULL']),
  customDomain: z.boolean().default(false),
  whiteLabel: z.boolean().default(false),
  public: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

export type CreatePlanDto = z.infer<typeof createPlanDto>;

// Built from scratch (no defaults) so PATCH only touches the fields sent.
export const updatePlanDto = z
  .object({
    name: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1),
    features: z.array(z.string().trim().min(1)),
    actionLabel: z.string().trim().min(1).max(60),
    priceCents: z.number().int().min(0),
    maxClientPages: z.number().int().min(0),
    maxMembers: z.number().int().min(1),
    maxForms: z.number().int().min(0),
    analyticsTier: z.enum(['BASIC', 'FULL']),
    customDomain: z.boolean(),
    whiteLabel: z.boolean(),
    public: z.boolean(),
    featured: z.boolean(),
    sortOrder: z.number().int(),
    active: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  });

export type UpdatePlanDto = z.infer<typeof updatePlanDto>;
