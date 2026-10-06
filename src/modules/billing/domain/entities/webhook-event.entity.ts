import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Inbox: raw provider events stored before processing (dedupe by external id). */
@Entity({ name: 'webhook_events' })
export class WebhookEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'provider', length: 40 })
  provider!: string;

  @Column({ name: 'external_event_id', length: 200 })
  externalEventId!: string;

  @Column({ name: 'type', length: 60 })
  type!: string;

  @Column({ name: 'payload', type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ name: 'error', type: 'text', nullable: true })
  error!: string | null;
}
