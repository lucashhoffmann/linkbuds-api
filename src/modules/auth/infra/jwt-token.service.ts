import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { TokenService } from '../application/ports/token.service';
import { AuthPayload } from 'src/shared/types/auth-payload.types';

@Injectable()
export class JwtTokenService implements TokenService {
  signAccess(payload: AuthPayload) {
    return jwt.sign(payload, process.env.ACCESS_TOKEN || 'secret', {
      expiresIn: '3d',
    });
  }

  signRefresh(payload: AuthPayload) {
    return jwt.sign(payload, process.env.REFRESH_TOKEN || 'secret', {
      expiresIn: '20d',
    });
  }
}
