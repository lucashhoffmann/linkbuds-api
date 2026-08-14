import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnalyticsEventType } from '../enums/analytics-event-type.enum';
import { AnalyticsTargetType } from '../enums/analytics-target-type.enum';
import { LinkPageEntity } from './link-page.entity';

@Entity({ name: 'link_page_analytics_events' })
export class LinkPageAnalyticsEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'varchar', length: 120, nullable: true })
  eventId!: string | null;

  @Column({ name: 'link_page_id', type: 'uuid', nullable: false })
  linkPageId!: string;

  @ManyToOne(() => LinkPageEntity, { nullable: false, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'link_page_id' })
  linkPage!: LinkPageEntity;

  @Column({ name: 'event_type', type: 'varchar', length: 30, nullable: false })
  eventType!: AnalyticsEventType;

  @Column({ name: 'target_type', type: 'varchar', length: 30, nullable: true })
  targetType!: AnalyticsTargetType | null;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId!: string | null;

  @Column({ name: 'visitor_id', type: 'varchar', length: 120, nullable: true })
  visitorId!: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 120, nullable: true })
  sessionId!: string | null;

  @Column({ name: 'referrer', type: 'text', nullable: true })
  referrer!: string | null;

  @Column({ name: 'utm_source', type: 'varchar', length: 120, nullable: true })
  utmSource!: string | null;

  @Column({ name: 'utm_medium', type: 'varchar', length: 120, nullable: true })
  utmMedium!: string | null;

  @Column({
    name: 'utm_campaign',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  utmCampaign!: string | null;

  @Column({ name: 'utm_content', type: 'varchar', length: 120, nullable: true })
  utmContent!: string | null;

  @Column({ name: 'utm_term', type: 'varchar', length: 120, nullable: true })
  utmTerm!: string | null;

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

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs!: number | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true, default: null })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
