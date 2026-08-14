import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkPageAnalyticsInsights1786651000000 implements MigrationInterface {
  name = 'LinkPageAnalyticsInsights1786651000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_page_analytics_events"
      ADD COLUMN "event_id" character varying(120)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_analytics_events_event_id"
      ON "link_page_analytics_events" ("event_id")
      WHERE "event_id" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "plans"
      SET "analytics_enabled" = true
      WHERE "code" IN ('FREE', 'AGENCY')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_analytics_events_event_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "link_page_analytics_events"
      DROP COLUMN "event_id"
    `);
    await queryRunner.query(`
      UPDATE "plans"
      SET "analytics_enabled" = false
      WHERE "code" = 'FREE'
    `);
  }
}
