import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ZodError } from 'zod';
import { AppException } from './app.exception';
import { ERRORS, type ErrorCode } from './error-catalog';

export interface ErrorResponseBody {
  success: false;
  statusCode: number;
  errorCode: string;
  /** HTTP reason, e.g. "Not Found" (kept for clients that read it). */
  error: string;
  message: string;
  /** Validation issues or other structured details. */
  errors?: unknown;
  requestId: string;
  timestamp: string;
  path: string;
}

interface NormalizedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Codes for HttpExceptions raised by Nest itself (routing, pipes, throttler). */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'AUTH_UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

const POSTGRES_UNIQUE_VIOLATION = '23505';

function fromCatalog(code: ErrorCode, details?: unknown): NormalizedError {
  return { ...ERRORS[code], code, details };
}

export function zodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Turns anything thrown into one response shape. Unknown errors become a
 * generic 500: their message/stack go to the logs, never to the client.
 */
export function normalizeError(exception: unknown): NormalizedError {
  if (exception instanceof AppException) {
    return {
      status: exception.getStatus(),
      code: exception.errorCode,
      message: exception.message,
      details: exception.details,
    };
  }

  if (exception instanceof ZodError) {
    return fromCatalog('VALIDATION_FAILED', zodIssues(exception));
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = CODE_BY_STATUS[status];
    const fallback = code
      ? ERRORS[code]
      : { status, message: ERRORS.INTERNAL_SERVER_ERROR.message };

    return {
      status,
      code:
        code ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : `HTTP_${status}`),
      // Nest's own messages are English/technical: show ours for 5xx.
      message:
        status < 500 ? fallback.message : ERRORS.INTERNAL_SERVER_ERROR.message,
    };
  }

  if (
    exception instanceof QueryFailedError &&
    (exception.driverError as { code?: string } | undefined)?.code ===
      POSTGRES_UNIQUE_VIOLATION
  ) {
    return fromCatalog('CONFLICT');
  }

  return fromCatalog('INTERNAL_SERVER_ERROR');
}

/** Global filter (registered with APP_FILTER in AppModule). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpError');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const error = normalizeError(exception);
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();
    const summary = `${request.method} ${request.originalUrl} ${error.status} ${error.code} [${requestId}]`;

    if (error.status >= 500) {
      this.logger.error(
        summary,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(summary);
    }

    const body: ErrorResponseBody = {
      success: false,
      statusCode: error.status,
      errorCode: error.code,
      error: HttpStatus[error.status] ?? 'Error',
      message: error.message,
      ...(error.details !== undefined ? { errors: error.details } : {}),
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.setHeader('x-request-id', requestId);
    response.status(error.status).json(body);
  }
}
