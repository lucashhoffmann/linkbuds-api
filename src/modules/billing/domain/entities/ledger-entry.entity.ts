import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** CHARGE/REFUND increase what the company owes; PAYMENT/CREDIT decrease it. */
export type LedgerEntryType = 'CHARGE' | 'PAYMENT' | 'REFUND' | 'CREDIT';

/** Append-only (DB trigger blocks UPDATE/DELETE). Insert-only, keyed by idempotency key. */
@Entity({ name: 'ledger_entries' })
export class LedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  @Column({ name: 'type', type: 'varchar', length: 20 })
  type!: LedgerEntryType;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'BRL' })
  currency!: string;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'provider', type: 'varchar', length: 40, nullable: true })
  provider!: string | null;

  @Column({
    name: 'provider_reference',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  providerReference!: string | null;

  @Column({ name: 'idempotency_key', length: 240 })
  idempotencyKey!: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
