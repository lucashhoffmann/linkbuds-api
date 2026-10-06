import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { DataSource } from 'typeorm';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { provisionAccount } from 'src/modules/auth/application/provision-account';
import {
  type BetterAuthUser,
  getBetterAuth,
  toBetterAuthHeaders,
} from 'src/modules/auth/infra/better-auth.config';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import { AuthPayload } from 'src/shared/types/auth-payload.types';

interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  auth?: AuthPayload;
  identity?: BetterAuthUser;
}

async function requireSessionUser(
  headers: IncomingHttpHeaders,
): Promise<BetterAuthUser> {
  const auth = await getBetterAuth();
  const session = await auth.api
    .getSession({ headers: await toBetterAuthHeaders(headers) })
    .catch(() => null);

  if (!session?.user?.id) {
    throw new AppException(ERROR_CODES.AUTH_UNAUTHORIZED);
  }

  return session.user;
}

/** Signed-in identity + company membership (provisioned on first access). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const identity = await requireSessionUser(request.headers);

    const user =
      (await this.dataSource.getRepository(UserEntity).findOne({
        where: { id: identity.id },
      })) ?? (await provisionAccount(this.dataSource, identity));

    request.auth = {
      id: user.id,
      companyId: user.companyId,
      role: user.role,
    };

    return true;
  }
}

/**
 * Signed-in identity only, without provisioning a company.
 * For flows that decide the membership themselves (accepting an invite).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.identity = await requireSessionUser(request.headers);

    return true;
  }
}
