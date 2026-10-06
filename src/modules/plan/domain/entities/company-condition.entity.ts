import { CompanyEntity } from 'src/modules/company/domain/entities/company.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AnalyticsTier } from '../entitlements';
import { PlanEntity } from './plan.entity';

/**
 * Special commercial condition granted to a selected company (the "CUSTOM" plan).
 * Null override = keep the base plan value. Coupons will create conditions too.
 */
@Entity({ name: 'company_conditions' })
export class CompanyConditionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => CompanyEntity, (company) => company.conditions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity;

  /** Replaces the company plan while the condition is active. */
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

  /** Set when the condition was granted by redeeming a coupon. */
  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz', default: () => 'now()' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
