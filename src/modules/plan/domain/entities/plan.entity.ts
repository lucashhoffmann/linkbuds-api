import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AnalyticsTier } from '../entitlements';

/** Public catalog entry. Special conditions per company live in `company_conditions`. */
@Entity({ name: 'plans' })
export class PlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code', length: 80, unique: true })
  code!: string;

  @Column({ name: 'name', length: 120 })
  name!: string;

  @Column({ name: 'label', length: 60 })
  label!: string;

  @Column({ name: 'description', type: 'text' })
  description!: string;

  @Column({ name: 'features', type: 'jsonb', default: () => "'[]'" })
  features!: string[];

  @Column({ name: 'action_label', length: 60 })
  actionLabel!: string;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents!: number;

  @Column({ name: 'max_client_pages', type: 'integer' })
  maxClientPages!: number;

  /** Team seats (members, owner included). */
  @Column({ name: 'max_members', type: 'integer' })
  maxMembers!: number;

  /** Form sub-pages across the whole company. */
  @Column({ name: 'max_forms', type: 'integer', default: 0 })
  maxForms!: number;

  @Column({ name: 'analytics_tier', type: 'varchar', length: 10 })
  analyticsTier!: AnalyticsTier;

  @Column({ name: 'custom_domain', type: 'boolean', default: false })
  customDomain!: boolean;

  @Column({ name: 'white_label', type: 'boolean', default: false })
  whiteLabel!: boolean;

  /** Listed in the public pricing page. */
  @Column({ name: 'public', type: 'boolean', default: true })
  public!: boolean;

  @Column({ name: 'featured', type: 'boolean', default: false })
  featured!: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  /** Available for new subscriptions; existing companies keep their plan. */
  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
