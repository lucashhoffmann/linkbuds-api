import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizePublicLinkPages1786653600000 implements MigrationInterface {
  name = 'OptimizePublicLinkPages1786653600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        duplicate_slug record;
      BEGIN
        SELECT "slug", COUNT(*) AS total
        INTO duplicate_slug
        FROM "link_pages"
        WHERE "deleted_at" IS NULL
        GROUP BY "slug"
        HAVING COUNT(*) > 1
        LIMIT 1;

        IF FOUND THEN
          RAISE EXCEPTION
            'Cannot create global public LinkPage slug index: duplicate non-deleted slug "%". Resolve duplicates before running this migration.',
            duplicate_slug."slug";
        END IF;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_link_pages_slug_global_active"
      ON "link_pages" ("slug")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_link_pages_public_slug_active"
      ON "link_pages" ("slug")
      WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_link_page_links_public_page_sort"
      ON "link_page_links" ("link_page_id", "placement", "sort_order", "created_at")
      WHERE "active" = true AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_link_page_social_links_public_page_sort"
      ON "link_page_social_links" ("link_page_id", "sort_order", "created_at")
      WHERE "active" = true AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_link_page_images_public_page_sort"
      ON "link_page_images" ("link_page_id", "sort_order", "created_at")
      WHERE "active" = true AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_company_domains_public_hostname_status"
      ON "company_domains" ("hostname", "status")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_company_domains_public_hostname_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_link_page_images_public_page_sort"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_link_page_social_links_public_page_sort"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_link_page_links_public_page_sort"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_link_pages_public_slug_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_link_pages_slug_global_active"`,
    );
  }
}
