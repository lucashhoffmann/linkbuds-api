import { AuthPayload } from 'src/shared/types/auth-payload.types';

export interface TokenService {
  signAccess(payload: AuthPayload): string;
  signRefresh(payload: AuthPayload): string;
}
