import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureAnalyticsEventId1786654300000 implements MigrationInterface {
  name = 'EnsureAnalyticsEventId1786654300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_page_analytics_events"
      ADD COLUMN IF NOT EXISTS "event_id" character varying(120)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_analytics_events_event_id"
      ON "link_page_analytics_events" ("event_id")
      WHERE "event_id" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    return undefined;
  }
}
