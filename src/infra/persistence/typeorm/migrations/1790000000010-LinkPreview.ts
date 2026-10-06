import { MigrationInterface, QueryRunner } from 'typeorm';

/** `PREVIEW` link kind: vertical card with image + description. */
export class LinkPreview1790000000010 implements MigrationInterface {
  name = 'LinkPreview1790000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_links" ADD "preview_image_url" text, ADD "preview_description" varchar(300)`,
    );
    await this.dropKindChecks(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "link_page_links"
        ADD CONSTRAINT "CHK_link_page_links_kind" CHECK ("kind" IN ('LINK', 'CONTACT', 'PREVIEW')),
        ADD CONSTRAINT "CHK_link_page_links_configuration" CHECK (
          ("kind" = 'LINK' AND "url" IS NOT NULL AND "contact_type" IS NULL AND "contact_value" IS NULL
            AND "preview_image_url" IS NULL AND "preview_description" IS NULL)
          OR ("kind" = 'CONTACT' AND "url" IS NULL AND "contact_type" IS NOT NULL AND "contact_value" IS NOT NULL
            AND "preview_image_url" IS NULL AND "preview_description" IS NULL)
          OR ("kind" = 'PREVIEW' AND "url" IS NOT NULL AND "contact_type" IS NULL AND "contact_value" IS NULL
            AND "placement" = 'VERTICAL')
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "link_page_links" WHERE "kind" = 'PREVIEW'`,
    );
    await this.dropKindChecks(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "link_page_links"
        DROP COLUMN "preview_image_url",
        DROP COLUMN "preview_description",
        ADD CONSTRAINT "CHK_link_page_links_kind" CHECK ("kind" IN ('LINK', 'CONTACT')),
        ADD CONSTRAINT "CHK_link_page_links_configuration" CHECK (
          ("kind" = 'LINK' AND "url" IS NOT NULL AND "contact_type" IS NULL AND "contact_value" IS NULL)
          OR ("kind" = 'CONTACT' AND "url" IS NULL AND "contact_type" IS NOT NULL AND "contact_value" IS NOT NULL)
        )
    `);
  }

  // InitialSchema left these unnamed; match them by definition.
  private async dropKindChecks(queryRunner: QueryRunner) {
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = '"link_page_links"'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) LIKE '%kind%'
        LOOP
          EXECUTE format('ALTER TABLE "link_page_links" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$
    `);
  }
}
