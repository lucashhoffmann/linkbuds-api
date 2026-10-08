import { MigrationInterface, QueryRunner } from 'typeorm';

/** Link button shape, label alignment and full-width horizontal cards. */
export class LinkPageLinkShape1790000000030 implements MigrationInterface {
  name = 'LinkPageLinkShape1790000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_links" ADD "shape" varchar(10) NOT NULL DEFAULT 'ROUNDED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_page_links" ADD "align" varchar(10) NOT NULL DEFAULT 'LEFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_page_links" ADD "full_width" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_links" DROP COLUMN "full_width"`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_page_links" DROP COLUMN "align"`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_page_links" DROP COLUMN "shape"`,
    );
  }
}
