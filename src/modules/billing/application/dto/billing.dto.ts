import { z } from 'zod';

const digits = (min: number, max: number, message: string) =>
  z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().min(min, message).max(max, message));

/** Card fields are forwarded to the gateway only: never logged or stored. */
export const subscribeDto = z
  .object({
    planCode: z.string().trim().min(1),
    billingCycle: z.enum(['MONTHLY', 'YEARLY']),
    /** Total shown to the payer (quote); a different server total is refused. */
    expectedTotalCents: z.number().int().positive(),
    /** Card installments: yearly only. */
    installmentCount: z.number().int().min(1).max(12).default(1),
    holder: z.object({
      name: z.string().trim().min(3).max(100),
      email: z.email().max(160),
      cpfCnpj: z
        .string()
        .transform((value) => value.replace(/\D/g, ''))
        .refine((value) => value.length === 11 || value.length === 14, {
          message: 'CPF ou CNPJ inválido',
        }),
      phone: digits(10, 11, 'Celular inválido'),
      postalCode: digits(8, 8, 'CEP inválido'),
      addressNumber: z.string().trim().min(1).max(10),
      addressComplement: z.string().trim().max(60).optional(),
    }),
    card: z.object({
      holderName: z.string().trim().min(3).max(60),
      number: digits(13, 19, 'Número do cartão inválido'),
      expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, 'Mês inválido'),
      expiryYear: z.string().regex(/^20\d{2}$/, 'Ano inválido'),
      ccv: z.string().regex(/^\d{3,4}$/, 'CVV inválido'),
    }),
  })
  .refine(
    (dto) => dto.installmentCount === 1 || dto.billingCycle === 'YEARLY',
    { message: 'Parcelamento só no plano anual', path: ['installmentCount'] },
  );
export type SubscribeDto = z.infer<typeof subscribeDto>;

/** Upgrade of the active subscription, charged on its stored card. */
export const upgradeDto = z.object({
  planCode: z.string().trim().min(1),
  /** Prorated total shown to the payer; 0 = upgrade without a charge. */
  expectedTotalCents: z.number().int().min(0),
});
export type UpgradeDto = z.infer<typeof upgradeDto>;

export const redeemCouponDto = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .transform((value) => value.toUpperCase()),
});
export type RedeemCouponDto = z.infer<typeof redeemCouponDto>;

const couponFields = {
  description: z.string().trim().max(500).nullable(),
  planCode: z.string().trim().min(1).nullable(),
  maxClientPages: z.number().int().min(0).nullable(),
  maxMembers: z.number().int().min(1).nullable(),
  priceCents: z.number().int().min(0).nullable(),
  discountPercent: z.number().int().min(0).max(100).nullable(),
  analyticsTier: z.enum(['BASIC', 'FULL']).nullable(),
  customDomain: z.boolean().nullable(),
  whiteLabel: z.boolean().nullable(),
  durationDays: z.number().int().min(1).nullable(),
  maxRedemptions: z.number().int().min(1).nullable(),
  expiresAt: z.coerce.date().nullable(),
  active: z.boolean(),
};

export const createCouponDto = z
  .object(couponFields)
  .partial()
  .extend({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{2,60}$/, 'Use letras, números, _ ou -')
      .transform((value) => value.toUpperCase()),
  });
export type CreateCouponDto = z.infer<typeof createCouponDto>;

export const updateCouponDto = z
  .object(couponFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  });
export type UpdateCouponDto = z.infer<typeof updateCouponDto>;
