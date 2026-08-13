import { z } from 'zod';
import { ERROR_CODES, ERRORS } from 'src/shared/constants/errors.constants';

export const updateUserDto = z
  .object({
    name: z
      .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
      .min(1, ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message)
      .optional(),
    email: z
      .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
      .email(ERRORS[ERROR_CODES.VALIDATION_INVALID_EMAIL].message)
      .optional(),
    password: z
      .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
      .min(6, ERRORS[ERROR_CODES.VALIDATION_MIN_LENGTH].message)
      .optional(),
    companyId: z.string().uuid().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.password !== undefined ||
      data.companyId !== undefined,
    {
      message: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message,
    },
  );

export type UpdateUserDto = z.infer<typeof updateUserDto>;
