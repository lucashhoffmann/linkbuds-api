import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { FormAnswer } from '../form-fields';
import { LinkPageEntity } from './link-page.entity';

/** One answer to a FORM page, with the visitor data the analytics events carry. */
@Entity({ name: 'link_page_form_submissions' })
export class LinkPageFormSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'link_page_id', type: 'uuid', nullable: false })
  linkPageId!: string;

  @ManyToOne(() => LinkPageEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'link_page_id' })
  linkPage!: LinkPageEntity;

  @Column({ name: 'answers', type: 'jsonb', nullable: false })
  answers!: FormAnswer[];

  @Column({ name: 'visitor_id', type: 'varchar', length: 120, nullable: true })
  visitorId!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ name: 'device_type', type: 'varchar', length: 40, nullable: true })
  deviceType!: string | null;

  @Column({ name: 'browser', type: 'varchar', length: 80, nullable: true })
  browser!: string | null;

  @Column({
    name: 'operating_system',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  operatingSystem!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  /** Set once the Google Sheets webhook accepted it; null = pending/failed. */
  @Column({ name: 'webhook_delivered_at', type: 'timestamptz', nullable: true })
  webhookDeliveredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
