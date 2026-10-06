import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import { LinkPageEntity } from 'src/modules/link-page/domain/entities/link-page.entity';
import { LinkPageStatus } from 'src/modules/link-page/domain/enums/link-page-status.enum';
import { LinkPageType } from 'src/modules/link-page/domain/enums/link-page-type.enum';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { DEFAULT_PLAN_CODE } from 'src/modules/plan/domain/entitlements';
import { UserEntity } from 'src/modules/user/domain/entities/user.entity';
import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Slugs are globally unique; suffix with random hex on collision.
async function availableSlug(manager: EntityManager, name: string) {
  const base = slugify(name) || 'agencia';
  const repository = manager.getRepository(LinkPageEntity);
  let slug = base;

  while (await repository.existsBy({ slug })) {
    slug = `${base}-${randomBytes(3).toString('hex')}`;
  }

  return slug;
}

export interface AuthIdentity {
  id: string;
  name: string;
  email: string;
}

/**
 * Ensures a better-auth identity has its membership (OWNER) + company (default plan)
 * + the agency's own page (AGENCY, free, outside the client-page quota).
 * Single entry point for every sign-up path (register, Google, /api/auth/sign-up),
 * and idempotent: safe to call on every request whose user is not provisioned yet.
 */
export function provisionAccount(
  dataSource: DataSource,
  identity: AuthIdentity,
  companyName?: string,
): Promise<UserEntity> {
  return dataSource.transaction(async (manager) => {
    // Serializes concurrent first requests of the same identity.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      identity.id,
    ]);

    const userRepository = manager.getRepository(UserEntity);
    const existing = await userRepository.findOne({
      where: { id: identity.id },
      relations: { company: true },
      withDeleted: true,
    });

    if (existing) {
      if (existing.deletedAt) {
        throw new AppException(ERROR_CODES.AUTH_UNAUTHORIZED);
      }

      return existing;
    }

    const freePlan = await manager.getRepository(PlanEntity).findOne({
      where: { code: DEFAULT_PLAN_CODE, active: true },
    });

    if (!freePlan) {
      throw new AppException(ERROR_CODES.LINK_PAGE_PLAN_REQUIRED);
    }

    const name = identity.name.trim() || identity.email;
    const email = identity.email.trim().toLowerCase();
    const companyRepository = manager.getRepository(CompanyEntity);
    const company = await companyRepository.save(
      companyRepository.create({
        // Google / direct sign-ups have no agency name yet: use the person's.
        name: companyName?.trim() || name,
        email,
        planId: freePlan.id,
      }),
    );

    const linkPageRepository = manager.getRepository(LinkPageEntity);
    await linkPageRepository.save(
      linkPageRepository.create({
        companyId: company.id,
        name: company.name,
        slug: await availableSlug(manager, company.name),
        type: LinkPageType.AGENCY,
        status: LinkPageStatus.ACTIVE,
        title: company.name,
      }),
    );

    return userRepository.save(
      userRepository.create({
        id: identity.id,
        companyId: company.id,
        company,
        role: UserRole.OWNER,
      }),
    );
  });
}
