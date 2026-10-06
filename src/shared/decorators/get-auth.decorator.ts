import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthPayload } from '../types/auth-payload.types';
import type { BetterAuthUser } from 'src/modules/auth/infra/better-auth.config';

export const GetAuth = createParamDecorator(
  (_, ctx: ExecutionContext): AuthPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.auth;
  },
);

/** Better-auth identity set by `SessionGuard`. */
export const GetIdentity = createParamDecorator(
  (_, ctx: ExecutionContext): BetterAuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.identity;
  },
);
