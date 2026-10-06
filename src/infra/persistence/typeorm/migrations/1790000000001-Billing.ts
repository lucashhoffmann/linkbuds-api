import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Billing core, gateway-agnostic: coupons, subscriptions, checkouts,
 * append-only ledger, idempotency keys and a webhook inbox.
 */
export class Billing1790000000001 implements MigrationInterface {
  name = 'Billing1790000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coupons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(60) NOT NULL UNIQUE CHECK ("code" = upper("code")),
        "description" text,
        "plan_id" uuid REFERENCES "plans"("id") ON DELETE RESTRICT,
        "max_client_pages" integer CHECK ("max_client_pages" >= 0),
        "max_members" integer CHECK ("max_members" >= 1),
        "price_cents" integer CHECK ("price_cents" >= 0),
        "discount_percent" integer CHECK ("discount_percent" BETWEEN 0 AND 100),
        "analytics_tier" varchar(10) CHECK ("analytics_tier" IN ('BASIC', 'FULL')),
        "custom_domain" boolean,
        "white_label" boolean,
        "duration_days" integer CHECK ("duration_days" > 0),
        "max_redemptions" integer CHECK ("max_redemptions" > 0),
        "redemptions_count" integer NOT NULL DEFAULT 0,
        "expires_at" timestamptz,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "company_conditions" ADD "coupon_id" uuid REFERENCES "coupons"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "coupon_redemptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "coupon_id" uuid NOT NULL REFERENCES "coupons"("id") ON DELETE CASCADE,
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "condition_id" uuid NOT NULL REFERENCES "company_conditions"("id") ON DELETE CASCADE,
        "redeemed_by" text REFERENCES "user"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("coupon_id", "company_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL UNIQUE REFERENCES "company"("id") ON DELETE CASCADE,
        "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE RESTRICT,
        "status" varchar(20) NOT NULL CHECK ("status" IN ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCELED')),
        "billing_cycle" varchar(10) NOT NULL CHECK ("billing_cycle" IN ('MONTHLY', 'YEARLY')),
        "amount_cents" integer NOT NULL CHECK ("amount_cents" >= 0),
        "provider" varchar(40) NOT NULL,
        "provider_customer_id" varchar(160),
        "provider_subscription_id" varchar(160) UNIQUE,
        "current_period_end" timestamptz,
        "cancel_at_period_end" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "billing_checkouts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE RESTRICT,
        "billing_cycle" varchar(10) NOT NULL CHECK ("billing_cycle" IN ('MONTHLY', 'YEARLY')),
        "amount_cents" integer NOT NULL CHECK ("amount_cents" >= 0),
        "provider" varchar(40) NOT NULL,
        "provider_session_id" varchar(160) UNIQUE,
        "checkout_url" text,
        "status" varchar(20) NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN', 'COMPLETED', 'EXPIRED')),
        "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Append-only: every financial fact is a new row; never edited or removed.
    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE RESTRICT,
        "subscription_id" uuid REFERENCES "subscriptions"("id") ON DELETE RESTRICT,
        "type" varchar(20) NOT NULL CHECK ("type" IN ('CHARGE', 'PAYMENT', 'REFUND', 'CREDIT')),
        "amount_cents" integer NOT NULL CHECK ("amount_cents" > 0),
        "currency" char(3) NOT NULL DEFAULT 'BRL',
        "description" text NOT NULL,
        "provider" varchar(40),
        "provider_reference" varchar(200),
        "idempotency_key" varchar(240) NOT NULL UNIQUE,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_entries_company_created" ON "ledger_entries" ("company_id", "created_at")`,
    );
    await queryRunner.query(`
      CREATE FUNCTION "ledger_entries_append_only"() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'ledger_entries is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_ledger_entries_append_only"
      BEFORE UPDATE OR DELETE ON "ledger_entries"
      FOR EACH ROW EXECUTE FUNCTION "ledger_entries_append_only"()
    `);

    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scope" varchar(160) NOT NULL,
        "key" varchar(160) NOT NULL,
        "request_hash" char(64) NOT NULL,
        "response" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("scope", "key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" varchar(40) NOT NULL,
        "external_event_id" varchar(200) NOT NULL,
        "type" varchar(60) NOT NULL,
        "payload" jsonb NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz,
        "error" text,
        UNIQUE ("provider", "external_event_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ledger_entries"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS "ledger_entries_append_only"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_checkouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupon_redemptions"`);
    await queryRunner.query(
      `ALTER TABLE "company_conditions" DROP COLUMN IF EXISTS "coupon_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons"`);
  }
}
