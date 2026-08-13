import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { ERROR_CODES, ERRORS } from '../constants/errors.constants';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = result.error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      throw new BadRequestException({
        message: ERRORS[ERROR_CODES.VALIDATION_FAILED].message,
        errorCode: ERROR_CODES.VALIDATION_FAILED,
        errors,
      });
    }

    return result.data;
  }
}
