import { MigrationInterface, QueryRunner } from 'typeorm';

/** Rich text blocks: `content` = runs `[{text, bold?, italic?, color?, size?}]`, no HTML. */
export class LinkPageTexts1790000000026 implements MigrationInterface {
  name = 'LinkPageTexts1790000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "link_page_texts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "link_page_id" uuid NOT NULL REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "content" jsonb NOT NULL DEFAULT '[]',
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_texts_public_page_sort" ON "link_page_texts" ("link_page_id", "sort_order", "created_at") WHERE "active" = true AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "link_page_texts"`);
  }
}
