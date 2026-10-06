import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, MoreThan } from 'typeorm';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { AuthUserEntity } from 'src/modules/auth/domain/entities/auth-user.entity';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { CompanyInviteEntity } from '../domain/entities/company-invite.entity';
import { CreateInviteDto } from './dto/team.dto';
import {
  acceptInvite,
  findValidInvite,
  inviteExpiry,
  inviteUrl,
  lockCompanySeats,
  newInviteToken,
  seatUsage,
} from './invite-token';

function assertOwner(auth: AuthPayload) {
  if (auth.role !== UserRole.OWNER) {
    throw new AppException(ERROR_CODES.TEAM_OWNER_REQUIRED);
  }
}

function toInviteResponse(invite: CompanyInviteEntity) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}

@Injectable()
export class TeamService {
  constructor(private readonly dataSource: DataSource) {}

  async get(auth: AuthPayload) {
    const manager = this.dataSource.manager;
    const members = await manager.getRepository(UserEntity).find({
      where: { companyId: auth.companyId },
      relations: { identity: true },
      order: { createdAt: 'ASC' },
    });
    const invites = await manager.getRepository(CompanyInviteEntity).find({
      where: {
        companyId: auth.companyId,
        acceptedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    return {
      usage: await seatUsage(manager, auth.companyId),
      members: members.map((member) => ({
        id: member.id,
        name: member.identity.name,
        email: member.identity.email,
        image: member.identity.image,
        role: member.role,
        createdAt: member.createdAt,
      })),
      invites: invites.map(toInviteResponse),
    };
  }

  /** Returns the invite link once; only its hash is stored. */
  async invite(auth: AuthPayload, dto: CreateInviteDto) {
    assertOwner(auth);

    return this.dataSource.transaction(async (manager) => {
      await lockCompanySeats(manager, auth.companyId);

      const identity = await manager
        .getRepository(AuthUserEntity)
        .createQueryBuilder('identity')
        .where('lower(identity.email) = :email', { email: dto.email })
        .getOne();

      if (
        identity &&
        (await manager.getRepository(UserEntity).existsBy({ id: identity.id }))
      ) {
        throw new AppException(ERROR_CODES.TEAM_ALREADY_MEMBER);
      }

      const invites = manager.getRepository(CompanyInviteEntity);
      const pending = await invites
        .createQueryBuilder('invite')
        .where('invite.company_id = :companyId', { companyId: auth.companyId })
        .andWhere('lower(invite.email) = :email', { email: dto.email })
        .andWhere('invite.accepted_at IS NULL')
        .getOne();

      if (pending && pending.expiresAt > new Date()) {
        throw new AppException(ERROR_CODES.TEAM_INVITE_ALREADY_PENDING);
      }

      if (pending) {
        await invites.softDelete({ id: pending.id });
      }

      if ((await seatUsage(manager, auth.companyId)).available < 1) {
        throw new AppException(ERROR_CODES.TEAM_SEAT_LIMIT_REACHED);
      }

      const { token, tokenHash } = newInviteToken();
      const invite = await invites.save(
        invites.create({
          companyId: auth.companyId,
          email: dto.email,
          role: UserRole.MEMBER,
          tokenHash,
          invitedBy: auth.id,
          expiresAt: inviteExpiry(),
        }),
      );

      return { invite: toInviteResponse(invite), url: inviteUrl(token) };
    });
  }

  /** New link + new 7-day expiry (old link stops working). */
  async renewInvite(auth: AuthPayload, inviteId: string) {
    assertOwner(auth);
    const invites = this.dataSource.getRepository(CompanyInviteEntity);
    const invite = await invites.findOne({
      where: { id: inviteId, companyId: auth.companyId, acceptedAt: IsNull() },
    });

    if (!invite) {
      throw new AppException(ERROR_CODES.TEAM_INVITE_INVALID);
    }

    const { token, tokenHash } = newInviteToken();
    invite.tokenHash = tokenHash;
    invite.expiresAt = inviteExpiry();
    await invites.save(invite);

    return { invite: toInviteResponse(invite), url: inviteUrl(token) };
  }

  async revokeInvite(auth: AuthPayload, inviteId: string) {
    assertOwner(auth);
    const result = await this.dataSource
      .getRepository(CompanyInviteEntity)
      .softDelete({
        id: inviteId,
        companyId: auth.companyId,
        acceptedAt: IsNull(),
      });

    if (!result.affected) {
      throw new AppException(ERROR_CODES.TEAM_INVITE_INVALID);
    }

    return { ok: true };
  }

  /**
   * Removes the membership. The person keeps the LinkBuds login; on the next
   * access they get a fresh FREE account of their own.
   */
  async removeMember(auth: AuthPayload, userId: string) {
    assertOwner(auth);
    const users = this.dataSource.getRepository(UserEntity);
    const member = await users.findOne({
      where: { id: userId, companyId: auth.companyId },
    });

    if (!member) {
      throw new AppException(ERROR_CODES.TEAM_MEMBER_NOT_FOUND);
    }

    if (member.role === UserRole.OWNER) {
      throw new AppException(ERROR_CODES.TEAM_CANNOT_REMOVE_OWNER);
    }

    await users.delete({ id: userId });

    return { ok: true };
  }

  /** Public preview for the invite page. */
  async preview(token: string) {
    const invite = await findValidInvite(this.dataSource.manager, token);

    return {
      companyName: invite.company.name,
      email: invite.email,
      expiresAt: invite.expiresAt,
    };
  }

  accept(identity: { id: string; email: string }, token: string) {
    return acceptInvite(this.dataSource, identity, token);
  }
}
