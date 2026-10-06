import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager, IsNull, MoreThan } from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import {
  ENTITLEMENT_RELATIONS,
  entitlementsFor,
} from 'src/modules/plan/domain/entitlements';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import { CompanyInviteEntity } from '../domain/entities/company-invite.entity';

export const INVITE_TTL_DAYS = 7;

export function newInviteToken() {
  const token = randomBytes(32).toString('base64url');

  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function inviteUrl(token: string) {
  const base = process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173';

  return `${base.replace(/\/$/, '')}/invite/${token}`;
}

export function inviteExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Pending, non-expired invite for the token, or 404. */
export async function findValidInvite(
  manager: EntityManager,
  token: string,
): Promise<CompanyInviteEntity> {
  const invite = await manager.getRepository(CompanyInviteEntity).findOne({
    where: {
      tokenHash: hashInviteToken(token),
      acceptedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    },
    relations: { company: true },
  });

  if (!invite) {
    throw new AppException(ERROR_CODES.TEAM_INVITE_INVALID);
  }

  return invite;
}

export function assertInviteEmail(invite: CompanyInviteEntity, email: string) {
  if (invite.email.toLowerCase() !== email.trim().toLowerCase()) {
    throw new AppException(ERROR_CODES.TEAM_INVITE_EMAIL_MISMATCH);
  }
}

/** Serializes seat checks of one company (invites and accepts). */
export async function lockCompanySeats(
  manager: EntityManager,
  companyId: string,
) {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `seats:${companyId}`,
  ]);
}

export async function seatUsage(manager: EntityManager, companyId: string) {
  const company = await manager.getRepository(CompanyEntity).findOneOrFail({
    where: { id: companyId },
    relations: ENTITLEMENT_RELATIONS,
  });
  const members = await manager
    .getRepository(UserEntity)
    .countBy({ companyId });
  const pendingInvites = await manager
    .getRepository(CompanyInviteEntity)
    .countBy({
      companyId,
      acceptedAt: IsNull(),
      expiresAt: MoreThan(new Date()),
    });
  const { maxMembers } = entitlementsFor(company);

  return {
    members,
    pendingInvites,
    maxMembers,
    available: Math.max(0, maxMembers - members - pendingInvites),
  };
}

/**
 * Joins the identity to the inviting company as MEMBER.
 * One person = one company in this cut: an identity that already belongs
 * to a company cannot accept (use another email).
 */
export function acceptInvite(
  dataSource: DataSource,
  identity: { id: string; email: string },
  token: string,
) {
  return dataSource.transaction(async (manager) => {
    const invite = await findValidInvite(manager, token);
    assertInviteEmail(invite, identity.email);
    await lockCompanySeats(manager, invite.companyId);

    const userRepository = manager.getRepository(UserEntity);
    const existing = await userRepository.findOne({
      where: { id: identity.id },
      withDeleted: true,
    });

    if (existing) {
      if (existing.companyId !== invite.companyId || existing.deletedAt) {
        throw new AppException(ERROR_CODES.TEAM_ALREADY_MEMBER);
      }
    } else {
      // The invite already reserved a seat; recheck in case the limit dropped.
      const members = await userRepository.countBy({
        companyId: invite.companyId,
      });
      const { maxMembers } = await seatUsage(manager, invite.companyId);

      if (members >= maxMembers) {
        throw new AppException(ERROR_CODES.TEAM_SEAT_LIMIT_REACHED);
      }

      await userRepository.save(
        userRepository.create({
          id: identity.id,
          companyId: invite.companyId,
          role: invite.role,
        }),
      );
    }

    invite.acceptedAt = new Date();
    invite.acceptedBy = identity.id;
    await manager.getRepository(CompanyInviteEntity).save(invite);

    return { companyId: invite.companyId, companyName: invite.company.name };
  });
}
