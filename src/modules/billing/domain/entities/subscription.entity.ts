import { PlanEntity } from 'src/modules/plan/domain/entities/plan.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SubscriptionStatus =
  'INCOMPLETE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

/** Current paid subscription of a company (one per company). */
@Entity({ name: 'subscriptions' })
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => PlanEntity)
  @JoinColumn({ name: 'plan_id' })
  plan!: PlanEntity;

  @Column({ name: 'status', type: 'varchar', length: 20 })
  status!: SubscriptionStatus;

  @Column({ name: 'billing_cycle', type: 'varchar', length: 10 })
  billingCycle!: BillingCycle;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ name: 'provider', length: 40 })
  provider!: string;

  @Column({
    name: 'provider_customer_id',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  providerCustomerId!: string | null;

  @Column({
    name: 'provider_subscription_id',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  providerSubscriptionId!: string | null;

  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
