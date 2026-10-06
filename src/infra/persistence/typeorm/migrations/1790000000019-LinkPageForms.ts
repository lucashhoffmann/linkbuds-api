import { MigrationInterface, QueryRunner } from 'typeorm';

/** FORM sub-pages (/p/:bio/:form): field config on the page + one row per submission. */
export class LinkPageForms1790000000019 implements MigrationInterface {
  name = 'LinkPageForms1790000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropTypeChecks(queryRunner);
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        ADD CONSTRAINT "CHK_link_pages_type" CHECK ("type" IN ('AGENCY', 'CLIENT', 'POST', 'FORM')),
        ADD CONSTRAINT "CHK_link_pages_parent" CHECK (("type" IN ('POST', 'FORM')) = ("parent_page_id" IS NOT NULL)),
        ADD "form" jsonb,
        ADD CONSTRAINT "CHK_link_pages_form" CHECK (("type" = 'FORM') = ("form" IS NOT NULL))
    `);
    await queryRunner.query(`
      CREATE TABLE "link_page_form_submissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "link_page_id" uuid NOT NULL REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "answers" jsonb NOT NULL,
        "visitor_id" varchar(120),
        "ip_address" varchar(45),
        "country_code" varchar(2),
        "device_type" varchar(40),
        "browser" varchar(80),
        "operating_system" varchar(80),
        "user_agent" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_form_submissions_page_created" ON "link_page_form_submissions" ("link_page_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "link_page_form_submissions"`);
    await queryRunner.query(`DELETE FROM "link_pages" WHERE "type" = 'FORM'`);
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        DROP CONSTRAINT "CHK_link_pages_form",
        DROP COLUMN "form",
        DROP CONSTRAINT "CHK_link_pages_type",
        DROP CONSTRAINT "CHK_link_pages_parent",
        ADD CONSTRAINT "CHK_link_pages_type" CHECK ("type" IN ('AGENCY', 'CLIENT', 'POST')),
        ADD CONSTRAINT "CHK_link_pages_parent" CHECK (("type" = 'POST') = ("parent_page_id" IS NOT NULL))
    `);
  }

  // InitialSchema left both unnamed; match them by definition.
  private async dropTypeChecks(queryRunner: QueryRunner) {
    await queryRunner.query(`
      DO $$
      DECLARE c record;
      BEGIN
        FOR c IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = '"link_pages"'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) ~ '\\mtype\\M'
        LOOP
          EXECUTE format('ALTER TABLE "link_pages" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$
    `);
  }
}
