import { MigrationInterface, QueryRunner } from 'typeorm';

/** Visitor IP per analytics event, shown on every plan. */
export class AnalyticsIpAddress1790000000009 implements MigrationInterface {
  name = 'AnalyticsIpAddress1790000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_analytics_events" ADD "ip_address" varchar(45)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_analytics_events" DROP COLUMN "ip_address"`,
    );
  }
}
