import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthPayload } from '../types/auth-payload.types';

export const GetAuth = createParamDecorator(
  (_, ctx: ExecutionContext): AuthPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.auth;
  },
);
