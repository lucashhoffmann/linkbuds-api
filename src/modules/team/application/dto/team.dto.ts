import { z } from 'zod';

export const createInviteDto = z.object({
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .transform((value) => value.toLowerCase()),
});

export type CreateInviteDto = z.infer<typeof createInviteDto>;

export const acceptInviteDto = z.object({
  token: z.string().trim().min(10),
});

export type AcceptInviteDto = z.infer<typeof acceptInviteDto>;
