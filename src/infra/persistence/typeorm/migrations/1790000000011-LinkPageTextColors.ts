import { MigrationInterface, QueryRunner } from 'typeorm';

/** Optional text colors; NULL = renderer default. */
export class LinkPageTextColors1790000000011 implements MigrationInterface {
  name = 'LinkPageTextColors1790000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        ADD "title_color" varchar(7) CHECK ("title_color" ~ '^#[0-9A-Fa-f]{6}$'),
        ADD "subtitle_color" varchar(7) CHECK ("subtitle_color" ~ '^#[0-9A-Fa-f]{6}$'),
        ADD "footer_color" varchar(7) CHECK ("footer_color" ~ '^#[0-9A-Fa-f]{6}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        DROP COLUMN "title_color",
        DROP COLUMN "subtitle_color",
        DROP COLUMN "footer_color"
    `);
  }
}
