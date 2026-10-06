import { MigrationInterface, QueryRunner } from 'typeorm';

const sizeCheck = (sizeColumn: string) => `
  ("${sizeColumn}" IN ('SMALL', 'MEDIUM', 'LARGE') AND "custom_height" IS NULL)
  OR ("${sizeColumn}" = 'CUSTOM' AND "custom_height" BETWEEN 80 AND 800)
`;

/** Video blocks + media size on links (only PREVIEW cards use it). */
export class LinkPageVideos1790000000012 implements MigrationInterface {
  name = 'LinkPageVideos1790000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "link_page_videos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "link_page_id" uuid NOT NULL REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "url" text NOT NULL,
        "title" varchar(120),
        "autoplay" boolean NOT NULL DEFAULT false,
        "size" varchar(10) NOT NULL DEFAULT 'MEDIUM',
        "custom_height" integer,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "CHK_link_page_videos_size" CHECK (${sizeCheck('size')})
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_videos_public_page_sort" ON "link_page_videos" ("link_page_id", "sort_order", "created_at") WHERE "active" = true AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "link_page_links"
        ADD "display_size" varchar(10) NOT NULL DEFAULT 'MEDIUM',
        ADD "custom_height" integer,
        ADD CONSTRAINT "CHK_link_page_links_size" CHECK (${sizeCheck('display_size')})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_page_links"
        DROP CONSTRAINT "CHK_link_page_links_size",
        DROP COLUMN "display_size",
        DROP COLUMN "custom_height"
    `);
    await queryRunner.query(`DROP TABLE "link_page_videos"`);
  }
}
