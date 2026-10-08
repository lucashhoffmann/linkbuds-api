import { z } from 'zod';

export const updateCompanyDto = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome da agência')
    .max(120, 'Nome deve ter no máximo 120 caracteres'),
});

export type UpdateCompanyDto = z.infer<typeof updateCompanyDto>;
