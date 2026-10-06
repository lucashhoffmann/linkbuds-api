import { MigrationInterface, QueryRunner } from 'typeorm';

/** PILL/BOX text blocks either hug their text or fill the content width. */
export class LinkPageTextFullWidth1790000000028 implements MigrationInterface {
  name = 'LinkPageTextFullWidth1790000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_texts" ADD "full_width" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_texts" DROP COLUMN "full_width"`,
    );
  }
}
