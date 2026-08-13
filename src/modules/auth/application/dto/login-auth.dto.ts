import { z } from 'zod';
import { ERROR_CODES, ERRORS } from 'src/shared/constants/errors.constants';

export const loginAuthDto = z.object({
  email: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .email(ERRORS[ERROR_CODES.VALIDATION_INVALID_EMAIL].message),
  password: z.string({
    error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message,
  }),
});

export type LoginAuthDto = z.infer<typeof loginAuthDto>;
