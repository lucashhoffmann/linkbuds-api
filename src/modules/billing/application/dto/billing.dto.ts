import { z } from 'zod';

export const checkoutDto = z.object({
  planCode: z.string().trim().min(1),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});
export type CheckoutDto = z.infer<typeof checkoutDto>;

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
