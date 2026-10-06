import { MigrationInterface, QueryRunner } from 'typeorm';

/** Footer font/logo size on pages + company default; company default also gets text color/bold. */
export class FooterTextAndLogoSize1790000000018 implements MigrationInterface {
  name = 'FooterTextAndLogoSize1790000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['link_pages', 'company']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD "footer_font_size" varchar(10) NOT NULL DEFAULT 'SMALL' CONSTRAINT "CHK_${table}_footer_font_size" CHECK ("footer_font_size" IN ('SMALL', 'MEDIUM', 'LARGE')),
          ADD "footer_logo_size" varchar(10) NOT NULL DEFAULT 'SMALL' CONSTRAINT "CHK_${table}_footer_logo_size" CHECK ("footer_logo_size" IN ('SMALL', 'MEDIUM', 'LARGE'))
      `);
    }
    await queryRunner.query(`
      ALTER TABLE "company"
        ADD "footer_color" varchar(7) CHECK ("footer_color" ~ '^#[0-9A-Fa-f]{6}$'),
        ADD "footer_bold" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company" DROP COLUMN "footer_color", DROP COLUMN "footer_bold"
    `);
    for (const table of ['link_pages', 'company']) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP COLUMN "footer_font_size", DROP COLUMN "footer_logo_size"
      `);
    }
  }
}
