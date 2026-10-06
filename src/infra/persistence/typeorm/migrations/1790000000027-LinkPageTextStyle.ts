import { MigrationInterface, QueryRunner } from 'typeorm';

/** Text block shape (same TEXT/PILL/BOX as the footer), colors and alignment. */
export class LinkPageTextStyle1790000000027 implements MigrationInterface {
  name = 'LinkPageTextStyle1790000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_page_texts"
        ADD "style" varchar(10) NOT NULL DEFAULT 'TEXT' CONSTRAINT "CHK_link_page_texts_style" CHECK ("style" IN ('TEXT', 'PILL', 'BOX')),
        ADD "align" varchar(10) NOT NULL DEFAULT 'LEFT' CONSTRAINT "CHK_link_page_texts_align" CHECK ("align" IN ('LEFT', 'CENTER', 'RIGHT')),
        ADD "background_color" varchar(7),
        ADD "border_color" varchar(7)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_page_texts"
        DROP COLUMN "style",
        DROP COLUMN "align",
        DROP COLUMN "background_color",
        DROP COLUMN "border_color"
    `);
  }
}
