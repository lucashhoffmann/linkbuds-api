import { MigrationInterface, QueryRunner } from 'typeorm';

/** Custom footer shape (TEXT/PILL/BOX) + background/border colors. */
export class LinkPageFooterStyle1790000000016 implements MigrationInterface {
  name = 'LinkPageFooterStyle1790000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        ADD "footer_style" varchar(10) NOT NULL DEFAULT 'TEXT' CONSTRAINT "CHK_link_pages_footer_style" CHECK ("footer_style" IN ('TEXT', 'PILL', 'BOX')),
        ADD "footer_background_color" varchar(7) CHECK ("footer_background_color" ~ '^#[0-9A-Fa-f]{6}$'),
        ADD "footer_border_color" varchar(7) CHECK ("footer_border_color" ~ '^#[0-9A-Fa-f]{6}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        DROP COLUMN "footer_style",
        DROP COLUMN "footer_background_color",
        DROP COLUMN "footer_border_color"
    `);
  }
}
