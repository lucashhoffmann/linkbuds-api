import { MigrationInterface, QueryRunner } from 'typeorm';

/** Owner's Google Tag Manager / GA4 IDs on bio pages. */
export class LinkPageTracking1790000000004 implements MigrationInterface {
  name = 'LinkPageTracking1790000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_pages" ADD "gtm_container_id" varchar(20), ADD "ga4_measurement_id" varchar(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_pages" DROP COLUMN "gtm_container_id", DROP COLUMN "ga4_measurement_id"`,
    );
  }
}
