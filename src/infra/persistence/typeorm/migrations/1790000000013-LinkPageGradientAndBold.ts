import { MigrationInterface, QueryRunner } from 'typeorm';

/** `GRADIENT` background (background_color → background_gradient_color) + bold text toggles. */
export class LinkPageGradientAndBold1790000000013 implements MigrationInterface {
  name = 'LinkPageGradientAndBold1790000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropBackgroundTypeCheck(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        ADD CONSTRAINT "CHK_link_pages_background_type" CHECK ("background_type" IN ('SOLID', 'IMAGE', 'GRADIENT')),
        ADD "background_gradient_color" varchar(7) NOT NULL DEFAULT '#FFFFFF' CHECK ("background_gradient_color" ~ '^#[0-9A-Fa-f]{6}$'),
        ADD "title_bold" boolean NOT NULL DEFAULT true,
        ADD "subtitle_bold" boolean NOT NULL DEFAULT false,
        ADD "footer_bold" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "link_pages" SET "background_type" = 'SOLID' WHERE "background_type" = 'GRADIENT'`,
    );
    await this.dropBackgroundTypeCheck(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        DROP COLUMN "background_gradient_color",
        DROP COLUMN "title_bold",
        DROP COLUMN "subtitle_bold",
        DROP COLUMN "footer_bold",
        ADD CONSTRAINT "CHK_link_pages_background_type" CHECK ("background_type" IN ('SOLID', 'IMAGE'))
    `);
  }

  // InitialSchema left this unnamed; match it by definition.
  private async dropBackgroundTypeCheck(queryRunner: QueryRunner) {
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = '"link_pages"'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%background_type%'
        LOOP
          EXECUTE format('ALTER TABLE "link_pages" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$
    `);
  }
}
