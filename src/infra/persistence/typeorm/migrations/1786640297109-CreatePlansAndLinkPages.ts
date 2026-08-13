import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlansAndLinkPages1786640297109 implements MigrationInterface {
  name = 'CreatePlansAndLinkPages1786640297109';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "code" character varying(80) NOT NULL,
        "type" character varying(20) NOT NULL,
        "max_client_pages" integer NOT NULL,
        "price_cents" integer NOT NULL,
        "company_id" uuid,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_plans_code" UNIQUE ("code"),
        CONSTRAINT "CHK_plans_type" CHECK ("type" IN ('STANDARD', 'CUSTOM')),
        CONSTRAINT "CHK_plans_max_client_pages_positive" CHECK ("max_client_pages" > 0),
        CONSTRAINT "CHK_plans_price_cents_non_negative" CHECK ("price_cents" >= 0),
        CONSTRAINT "CHK_plans_type_company_id" CHECK (
          ("type" = 'STANDARD' AND "company_id" IS NULL)
          OR
          ("type" = 'CUSTOM' AND "company_id" IS NOT NULL)
        ),
        CONSTRAINT "PK_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_plans_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_plans_company_id" ON "plans" ("company_id")`,
    );

    await queryRunner.query(`ALTER TABLE "company" ADD "plan_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "company"
      ADD CONSTRAINT "FK_company_plan_id"
      FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_company_plan_id" ON "company" ("plan_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_pages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "slug" character varying(160) NOT NULL,
        "type" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "CHK_link_pages_type" CHECK ("type" IN ('AGENCY', 'CLIENT')),
        CONSTRAINT "CHK_link_pages_status" CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
        CONSTRAINT "PK_link_pages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_link_pages_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_pages_company_id" ON "link_pages" ("company_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_link_pages_company_slug_active"
      ON "link_pages" ("company_id", "slug")
      WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_link_pages_company_agency_active"
      ON "link_pages" ("company_id")
      WHERE "type" = 'AGENCY' AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "enforce_company_current_plan_owner"()
      RETURNS trigger AS $$
      DECLARE
        selected_plan record;
      BEGIN
        IF NEW."plan_id" IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT "type", "company_id"
        INTO selected_plan
        FROM "plans"
        WHERE "id" = NEW."plan_id";

        IF NOT FOUND THEN
          RETURN NEW;
        END IF;

        IF selected_plan."type" = 'CUSTOM'
          AND selected_plan."company_id" IS DISTINCT FROM NEW."id" THEN
          RAISE EXCEPTION 'CUSTOM plan can only be used by its owner company';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_company_current_plan_owner"
      BEFORE INSERT OR UPDATE OF "id", "plan_id" ON "company"
      FOR EACH ROW
      EXECUTE FUNCTION "enforce_company_current_plan_owner"()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "enforce_custom_plan_current_users"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."type" = 'CUSTOM'
          AND EXISTS (
            SELECT 1
            FROM "company" company
            WHERE company."plan_id" = NEW."id"
              AND company."id" IS DISTINCT FROM NEW."company_id"
          ) THEN
          RAISE EXCEPTION 'CUSTOM plan cannot be assigned to a different company';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_plans_custom_owner_current_users"
      BEFORE INSERT OR UPDATE OF "id", "type", "company_id" ON "plans"
      FOR EACH ROW
      EXECUTE FUNCTION "enforce_custom_plan_current_users"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_plans_custom_owner_current_users" ON "plans"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS "TRG_company_current_plan_owner" ON "company"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "enforce_custom_plan_current_users"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "enforce_company_current_plan_owner"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_link_pages_company_agency_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_link_pages_company_slug_active"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_link_pages_company_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_company_plan_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plans_company_id"`);

    await queryRunner.query(
      `ALTER TABLE "link_pages" DROP CONSTRAINT "FK_link_pages_company_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company" DROP CONSTRAINT "FK_company_plan_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plans" DROP CONSTRAINT "FK_plans_company_id"`,
    );
    await queryRunner.query(`DROP TABLE "link_pages"`);
    await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "plan_id"`);
    await queryRunner.query(`DROP TABLE "plans"`);
  }
}
