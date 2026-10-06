import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';

export const ADMIN_API_KEY_HEADER = 'x-admin-key';

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

/**
 * Internal operations (LinkBuds team, never agency users).
 * Disabled when ADMIN_API_KEY is not set.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_KEY?.trim();
    const request = context
      .switchToHttp()
      .getRequest<{ headers: IncomingHttpHeaders }>();
    const received = request.headers[ADMIN_API_KEY_HEADER];

    if (
      !expected ||
      typeof received !== 'string' ||
      !timingSafeEqual(digest(received), digest(expected))
    ) {
      throw new AppException(ERROR_CODES.ADMIN_UNAUTHORIZED);
    }

    return true;
  }
}
