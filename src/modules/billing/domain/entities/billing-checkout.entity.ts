import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { BillingCycle } from './subscription.entity';

/** A checkout started by the company; the webhook completes it. */
@Entity({ name: 'billing_checkouts' })
export class BillingCheckoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'billing_cycle', type: 'varchar', length: 10 })
  billingCycle!: BillingCycle;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ name: 'provider', length: 40 })
  provider!: string;

  @Column({
    name: 'provider_session_id',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  providerSessionId!: string | null;

  @Column({ name: 'checkout_url', type: 'text', nullable: true })
  checkoutUrl!: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'OPEN' })
  status!: 'OPEN' | 'COMPLETED' | 'EXPIRED';

  @Column({ name: 'created_by', type: 'text', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
