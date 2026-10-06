import { MigrationInterface, QueryRunner } from 'typeorm';

/** Company default footer gets the same style fields as link_pages. */
export class CompanyFooterStyle1790000000017 implements MigrationInterface {
  name = 'CompanyFooterStyle1790000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
        ADD "footer_style" varchar(10) NOT NULL DEFAULT 'TEXT' CONSTRAINT "CHK_companies_footer_style" CHECK ("footer_style" IN ('TEXT', 'PILL', 'BOX')),
        ADD "footer_background_color" varchar(7) CHECK ("footer_background_color" ~ '^#[0-9A-Fa-f]{6}$'),
        ADD "footer_border_color" varchar(7) CHECK ("footer_border_color" ~ '^#[0-9A-Fa-f]{6}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
        DROP COLUMN "footer_style",
        DROP COLUMN "footer_background_color",
        DROP COLUMN "footer_border_color"
    `);
  }
}
