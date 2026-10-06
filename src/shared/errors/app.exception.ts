import { HttpException } from '@nestjs/common';
import { ERRORS, type ErrorCode } from './error-catalog';

export interface AppExceptionOptions {
  /** Overrides the catalog message (keep it user-facing, pt-BR). */
  message?: string;
  /** Structured extra info for the client, e.g. validation issues. */
  details?: unknown;
  /** Original error, kept for logs only (never sent to the client). */
  cause?: unknown;
}

/**
 * The only exception the app throws on purpose. Status and default message
 * come from the catalog, so a code always means the same HTTP response.
 */
export class AppException extends HttpException {
  readonly errorCode: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    const definition = ERRORS[code];
    super(options.message ?? definition.message, definition.status, {
      cause: options.cause,
    });
    this.errorCode = code;
    this.details = options.details;
  }
}
