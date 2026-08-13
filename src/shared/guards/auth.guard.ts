import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { UnauthorizedException } from 'src/shared/exceptions/business.exception';
import { AuthPayload } from 'src/shared/types/auth-payload.types';

function extractToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token;
  }

  return authorization;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = extractToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException(ERROR_CODES.AUTH_TOKEN_MISSING);
    }

    try {
      request.auth = jwt.verify(
        token,
        process.env.ACCESS_TOKEN || 'secret',
      ) as AuthPayload;
      return true;
    } catch {
      throw new UnauthorizedException(ERROR_CODES.AUTH_TOKEN_INVALID);
    }
  }
}
