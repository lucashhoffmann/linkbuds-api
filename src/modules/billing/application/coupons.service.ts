import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CompanyConditionEntity } from 'src/modules/plan/domain/entities/company-condition.entity';
import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import { UserRole } from 'src/modules/user/domain/enums/user-role.enum';
import { ERROR_CODES } from 'src/shared/errors/error-catalog';
import { AppException } from 'src/shared/errors/app.exception';
import type { AuthPayload } from 'src/shared/types/auth-payload.types';
import { CouponRedemptionEntity } from '../domain/entities/coupon-redemption.entity';
import { CouponEntity } from '../domain/entities/coupon.entity';
import type {
  CreateCouponDto,
  RedeemCouponDto,
  UpdateCouponDto,
} from './dto/billing.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CouponsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Grants the coupon as a company condition. Idempotent: redeeming the same
   * coupon again returns the existing grant (one redemption per company).
   */
  redeem(auth: AuthPayload, dto: RedeemCouponDto) {
    if (auth.role !== UserRole.OWNER) {
      throw new AppException(ERROR_CODES.BILLING_OWNER_REQUIRED);
    }

    return this.dataSource.transaction(async (manager) => {
      const coupon = await manager.getRepository(CouponEntity).findOne({
        where: { code: dto.code },
        lock: { mode: 'pessimistic_write' },
      });
      const now = new Date();

      if (
        !coupon ||
        !coupon.active ||
        (coupon.expiresAt && coupon.expiresAt <= now)
      ) {
        throw new AppException(ERROR_CODES.COUPON_INVALID);
      }

      const redemptions = manager.getRepository(CouponRedemptionEntity);
      const previous = await redemptions.findOneBy({
        couponId: coupon.id,
        companyId: auth.companyId,
      });

      if (previous) {
        return {
          code: coupon.code,
          conditionId: previous.conditionId,
          alreadyRedeemed: true,
        };
      }

      if (
        coupon.maxRedemptions != null &&
        coupon.redemptionsCount >= coupon.maxRedemptions
      ) {
        throw new AppException(ERROR_CODES.COUPON_EXHAUSTED);
      }

      const conditions = manager.getRepository(CompanyConditionEntity);
      const condition = await conditions.save(
        conditions.create({
          companyId: auth.companyId,
          couponId: coupon.id,
          planId: coupon.planId,
          maxClientPages: coupon.maxClientPages,
          maxMembers: coupon.maxMembers,
          priceCents: coupon.priceCents,
          discountPercent: coupon.discountPercent,
          analyticsTier: coupon.analyticsTier,
          customDomain: coupon.customDomain,
          whiteLabel: coupon.whiteLabel,
          note: `Cupom ${coupon.code}`,
          startsAt: now,
          endsAt: coupon.durationDays
            ? new Date(now.getTime() + coupon.durationDays * DAY_MS)
            : null,
        }),
      );
      await redemptions.save(
        redemptions.create({
          couponId: coupon.id,
          companyId: auth.companyId,
          conditionId: condition.id,
          redeemedBy: auth.id,
        }),
      );
      coupon.redemptionsCount += 1;
      await manager.getRepository(CouponEntity).save(coupon);

      return {
        code: coupon.code,
        conditionId: condition.id,
        alreadyRedeemed: false,
      };
    });
  }

  list() {
    return this.dataSource.getRepository(CouponEntity).find({
      relations: { plan: true },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateCouponDto) {
    const repository = this.dataSource.getRepository(CouponEntity);

    if (await repository.existsBy({ code: dto.code })) {
      throw new AppException(ERROR_CODES.COUPON_ALREADY_EXISTS);
    }

    const { planCode, ...fields } = dto;

    return repository.save(
      repository.create({ ...fields, planId: await this.planId(planCode) }),
    );
  }

  /** Deactivating stops new redemptions; existing grants stay (revoke via conditions). */
  async update(code: string, dto: UpdateCouponDto) {
    const repository = this.dataSource.getRepository(CouponEntity);
    const coupon = await repository.findOneBy({ code: code.toUpperCase() });

    if (!coupon) {
      throw new AppException(ERROR_CODES.COUPON_INVALID);
    }

    const { planCode, ...fields } = dto;
    Object.assign(coupon, fields);

    if (planCode !== undefined) {
      coupon.planId = await this.planId(planCode);
    }

    return repository.save(coupon);
  }

  private async planId(code: string | null | undefined) {
    if (!code) {
      return null;
    }

    const plan = await this.dataSource
      .getRepository(PlanEntity)
      .findOneBy({ code });

    if (!plan) {
      throw new AppException(ERROR_CODES.PLAN_NOT_FOUND);
    }

    return plan.id;
  }
}
