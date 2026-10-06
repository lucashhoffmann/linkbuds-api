import { HttpStatus, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { QueryFailedError } from 'typeorm';
import { z } from 'zod';
import { AppException } from '../app.exception';
import { AllExceptionsFilter, normalizeError } from '../all-exceptions.filter';
import { ERRORS, ERROR_CODES } from '../error-catalog';

describe('error catalog', () => {
  it('maps every code to itself and to a status + message', () => {
    for (const [code, definition] of Object.entries(ERRORS)) {
      expect(ERROR_CODES[code as keyof typeof ERRORS]).toBe(code);
      expect(HttpStatus[definition.status]).toBeDefined();
      expect(definition.message.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeError', () => {
  it('uses the catalog status and message for AppException', () => {
    expect(
      normalizeError(new AppException(ERROR_CODES.COUPON_EXHAUSTED)),
    ).toEqual({
      status: 409,
      code: 'COUPON_EXHAUSTED',
      message: 'Cupom esgotado',
      details: undefined,
    });
    expect(
      normalizeError(
        new AppException('VALIDATION_FAILED', { details: [{ path: 'x' }] }),
      ),
    ).toMatchObject({ status: 400, details: [{ path: 'x' }] });
  });

  it('gives Nest built-in exceptions a code and our message', () => {
    expect(normalizeError(new NotFoundException('Cannot GET /nope'))).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado',
    });
    expect(normalizeError(new ThrottlerException())).toMatchObject({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('maps zod errors and unique violations', () => {
    const zod = z
      .object({ email: z.string().email() })
      .safeParse({ email: 'x' });
    expect(normalizeError(!zod.success && zod.error)).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      details: [expect.objectContaining({ path: 'email' })],
    });

    const unique = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('dup'), { code: '23505' }),
    );
    expect(normalizeError(unique)).toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
  });

  it('never leaks unexpected error messages', () => {
    expect(
      normalizeError(
        new Error('password authentication failed for user "postgres"'),
      ),
    ).toEqual({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor',
      details: undefined,
    });
  });
});

describe('AllExceptionsFilter', () => {
  it('writes the standard body with a request id', () => {
    const json = jest.fn();
    const response = {
      setHeader: jest.fn(),
      status: jest.fn(() => ({ json })),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/x',
          headers: { 'x-request-id': 'req-1' },
        }),
        getResponse: () => response,
      }),
    };

    new AllExceptionsFilter().catch(
      new AppException(ERROR_CODES.PLAN_NOT_FOUND),
      host as never,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'req-1');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        errorCode: 'PLAN_NOT_FOUND',
        error: 'NOT_FOUND',
        message: 'Plano não encontrado',
        requestId: 'req-1',
        path: '/x',
      }),
    );
  });
});
