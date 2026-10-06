import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'coupon_redemptions' })
export class CouponRedemptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'condition_id', type: 'uuid' })
  conditionId!: string;

  @Column({ name: 'redeemed_by', type: 'text', nullable: true })
  redeemedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
