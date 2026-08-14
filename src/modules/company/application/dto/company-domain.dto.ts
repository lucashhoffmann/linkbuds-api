import { z } from 'zod';

export const createCompanyDomainDto = z.object({
  hostname: z.string().trim().min(1).max(253),
});

export type CreateCompanyDomainDto = z.infer<typeof createCompanyDomainDto>;
