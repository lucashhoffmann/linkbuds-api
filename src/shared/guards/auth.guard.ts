import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { DataSource } from 'typeorm';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import {
  getBetterAuth,
  toBetterAuthHeaders,
} from 'src/modules/auth/infra/better-auth.config';
import { ERROR_CODES } from 'src/shared/constants/errors.constants';
import { UnauthorizedException } from 'src/shared/exceptions/business.exception';
import { AuthPayload } from 'src/shared/types/auth-payload.types';

interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  auth?: AuthPayload;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = await getBetterAuth();
    const session = await auth.api
      .getSession({
        headers: await toBetterAuthHeaders(request.headers),
      })
      .catch(() => null);

    if (!session?.user?.id) {
      throw new UnauthorizedException(ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    const user = await this.dataSource.getRepository(UserEntity).findOne({
      where: { id: session.user.id },
      relations: { company: true },
    });

    if (!user?.company?.id) {
      throw new UnauthorizedException(ERROR_CODES.AUTH_UNAUTHORIZED);
    }

    request.auth = {
      id: user.id,
      companyId: user.company.id,
    };

    return true;
  }
}
