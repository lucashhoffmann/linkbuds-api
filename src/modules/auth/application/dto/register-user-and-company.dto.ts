import { z } from 'zod';
import { ERROR_CODES, ERRORS } from 'src/shared/errors/error-catalog';

export const registerUserAndCompanyDto = z.object({
  name: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .min(1, ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message),
  email: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .email(ERRORS[ERROR_CODES.VALIDATION_INVALID_EMAIL].message),
  password: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .min(6, ERRORS[ERROR_CODES.VALIDATION_MIN_LENGTH].message),
  companyName: z
    .string({ error: ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message })
    .min(1, ERRORS[ERROR_CODES.VALIDATION_REQUIRED_FIELD].message)
    .optional(),
  /** Joins the inviting company instead of creating one. */
  inviteToken: z.string().trim().min(10).optional(),
});

export type RegisterUserAndCompanyDto = z.infer<
  typeof registerUserAndCompanyDto
>;
