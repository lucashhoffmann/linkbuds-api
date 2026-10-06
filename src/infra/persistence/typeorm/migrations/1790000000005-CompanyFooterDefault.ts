import { MigrationInterface, QueryRunner } from 'typeorm';

/** Company-wide default footer, copied into new pages. */
export class CompanyFooterDefault1790000000005 implements MigrationInterface {
  name = 'CompanyFooterDefault1790000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company" ADD "footer_mode" varchar(20) NOT NULL DEFAULT 'LINKBUDS' CONSTRAINT "CHK_company_footer_mode" CHECK ("footer_mode" IN ('LINKBUDS', 'CUSTOM', 'HIDDEN')), ADD "footer_text" varchar(160), ADD "footer_url" text, ADD "footer_logo_url" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company" DROP COLUMN "footer_mode", DROP COLUMN "footer_text", DROP COLUMN "footer_url", DROP COLUMN "footer_logo_url"`,
    );
  }
}
