import { z } from 'zod';
import { ERROR_CODES, ERRORS } from 'src/shared/constants/errors.constants';

export const createUserDto = z.object({
  name: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .min(1, ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message),
  email: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .email(ERRORS[ERROR_CODES.VALIDATION_INVALID_EMAIL].message),
  password: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .min(6, ERRORS[ERROR_CODES.VALIDATION_MIN_LENGTH].message),
  companyId: z.string().uuid().optional(),
});

export type CreateUserDto = z.infer<typeof createUserDto>;
