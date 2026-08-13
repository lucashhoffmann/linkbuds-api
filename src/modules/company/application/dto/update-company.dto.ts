import { z } from 'zod';
import { ERROR_CODES, ERRORS } from 'src/shared/constants/errors.constants';

export const updateCompanyDto = z
  .object({
    name: z
      .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
      .min(1, ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message)
      .optional(),
    email: z
      .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
      .email(ERRORS[ERROR_CODES.VALIDATION_INVALID_EMAIL].message)
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message,
  });

export type UpdateCompanyDto = z.infer<typeof updateCompanyDto>;
