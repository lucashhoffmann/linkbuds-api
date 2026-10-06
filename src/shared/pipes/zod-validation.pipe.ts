import { PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppException } from '../errors/app.exception';
import { zodIssues } from '../errors/all-exceptions.filter';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new AppException('VALIDATION_FAILED', {
        details: zodIssues(result.error),
      });
    }

    return result.data;
  }
}
