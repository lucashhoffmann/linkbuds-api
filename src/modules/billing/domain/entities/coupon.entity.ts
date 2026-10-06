import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import type { AnalyticsTier } from 'src/modules/plan/domain/entitlements';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Redeeming a coupon creates a company condition with these overrides. */
@Entity({ name: 'coupons' })
export class CouponEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', length: 60 })
  code!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId!: string | null;

  @ManyToOne(() => PlanEntity, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan!: PlanEntity | null;

  @Column({ name: 'max_client_pages', type: 'integer', nullable: true })
  maxClientPages!: number | null;

  @Column({ name: 'max_members', type: 'integer', nullable: true })
  maxMembers!: number | null;

  @Column({ name: 'price_cents', type: 'integer', nullable: true })
  priceCents!: number | null;

  @Column({ name: 'discount_percent', type: 'integer', nullable: true })
  discountPercent!: number | null;

  @Column({
    name: 'analytics_tier',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  analyticsTier!: AnalyticsTier | null;

  @Column({ name: 'custom_domain', type: 'boolean', nullable: true })
  customDomain!: boolean | null;

  @Column({ name: 'white_label', type: 'boolean', nullable: true })
  whiteLabel!: boolean | null;

  /** How long the granted condition lasts; null = forever. */
  @Column({ name: 'duration_days', type: 'integer', nullable: true })
  durationDays!: number | null;

  @Column({ name: 'max_redemptions', type: 'integer', nullable: true })
  maxRedemptions!: number | null;

  @Column({ name: 'redemptions_count', type: 'integer', default: 0 })
  redemptionsCount!: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
