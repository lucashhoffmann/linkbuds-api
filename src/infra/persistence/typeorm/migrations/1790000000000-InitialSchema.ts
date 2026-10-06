import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Consolidated baseline (2026-10-03). Replaces the earlier migration history,
 * which had no production data.
 */
export class InitialSchema1790000000000 implements MigrationInterface {
  name = 'InitialSchema1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- better-auth (identity). Column names follow better-auth defaults.
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "image" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "account" (
        "id" text PRIMARY KEY,
        "accountId" text NOT NULL,
        "providerId" text NOT NULL,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "accessToken" text,
        "refreshToken" text,
        "idToken" text,
        "accessTokenExpiresAt" timestamptz,
        "refreshTokenExpiresAt" timestamptz,
        "scope" text,
        "password" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("providerId", "accountId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "session" (
        "id" text PRIMARY KEY,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "token" text NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "ipAddress" text,
        "userAgent" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "verification" (
        "id" text PRIMARY KEY,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_account_userId" ON "account" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_userId" ON "session" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_verification_identifier" ON "verification" ("identifier")`,
    );

    // --- Plans (public catalog) and companies.
    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(80) NOT NULL UNIQUE,
        "name" varchar(120) NOT NULL,
        "label" varchar(60) NOT NULL,
        "description" text NOT NULL,
        "features" jsonb NOT NULL DEFAULT '[]',
        "action_label" varchar(60) NOT NULL,
        "price_cents" integer NOT NULL CHECK ("price_cents" >= 0),
        "max_client_pages" integer NOT NULL CHECK ("max_client_pages" >= 0),
        "max_members" integer NOT NULL CHECK ("max_members" >= 1),
        "analytics_tier" varchar(10) NOT NULL CHECK ("analytics_tier" IN ('BASIC', 'FULL')),
        "custom_domain" boolean NOT NULL DEFAULT false,
        "white_label" boolean NOT NULL DEFAULT false,
        "public" boolean NOT NULL DEFAULT true,
        "featured" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "company" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "email" varchar NOT NULL,
        "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_company_plan_id" ON "company" ("plan_id")`,
    );

    // Membership of an identity in a company (same id as "user").
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "role" varchar(20) NOT NULL CHECK ("role" IN ('OWNER', 'MEMBER')),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_company_id" ON "users" ("company_id")`,
    );

    // Special conditions for selected companies ("CUSTOM"); null = keep plan value.
    await queryRunner.query(`
      CREATE TABLE "company_conditions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "plan_id" uuid REFERENCES "plans"("id") ON DELETE RESTRICT,
        "max_client_pages" integer CHECK ("max_client_pages" >= 0),
        "max_members" integer CHECK ("max_members" >= 1),
        "price_cents" integer CHECK ("price_cents" >= 0),
        "discount_percent" integer CHECK ("discount_percent" BETWEEN 0 AND 100),
        "analytics_tier" varchar(10) CHECK ("analytics_tier" IN ('BASIC', 'FULL')),
        "custom_domain" boolean,
        "white_label" boolean,
        "note" text,
        "starts_at" timestamptz NOT NULL DEFAULT now(),
        "ends_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_company_conditions_company_id" ON "company_conditions" ("company_id")`,
    );

    // Team invites (link shared by the OWNER). Only the token hash is stored.
    await queryRunner.query(`
      CREATE TABLE "company_invites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "email" varchar NOT NULL,
        "role" varchar(20) NOT NULL DEFAULT 'MEMBER' CHECK ("role" IN ('MEMBER')),
        "token_hash" varchar(64) NOT NULL UNIQUE,
        "invited_by" text REFERENCES "user"("id") ON DELETE SET NULL,
        "expires_at" timestamptz NOT NULL,
        "accepted_at" timestamptz,
        "accepted_by" text REFERENCES "user"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_company_invites_pending_email" ON "company_invites" ("company_id", lower("email")) WHERE "accepted_at" IS NULL AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "company_domains" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "hostname" varchar(253) NOT NULL,
        "status" varchar(20) NOT NULL CHECK ("status" IN ('PENDING', 'VERIFIED', 'ACTIVE', 'FAILED')),
        "verification_token" varchar(160) NOT NULL,
        "verified_at" timestamptz,
        "last_checked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_company_domains_hostname_active" ON "company_domains" ("hostname") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_company_domains_company_active" ON "company_domains" ("company_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_company_domains_public_hostname_status" ON "company_domains" ("hostname", "status") WHERE "deleted_at" IS NULL`,
    );

    // --- Link pages.
    await queryRunner.query(`
      CREATE TABLE "link_pages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL REFERENCES "company"("id") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "slug" varchar(160) NOT NULL,
        "type" varchar(20) NOT NULL CHECK ("type" IN ('AGENCY', 'CLIENT', 'POST')),
        -- POST = sub-page of a bio page (/p/:cliente/:post).
        "parent_page_id" uuid REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "post_network" varchar(20) CHECK ("post_network" IS NULL OR "post_network" IN ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X', 'WHATSAPP', 'GITHUB', 'PINTEREST')),
        "post_url" text,
        "status" varchar(20) NOT NULL CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
        "layout" varchar(20) NOT NULL DEFAULT 'LAYOUT_1' CHECK ("layout" IN ('LAYOUT_1', 'LAYOUT_2', 'LAYOUT_3')),
        "background_type" varchar(20) NOT NULL DEFAULT 'SOLID' CHECK ("background_type" IN ('SOLID', 'IMAGE')),
        "background_color" varchar(7) NOT NULL DEFAULT '#FFFFFF' CHECK ("background_color" ~ '^#[0-9A-Fa-f]{6}$'),
        "background_image_url" text,
        "avatar_url" text,
        "title" varchar(140) NOT NULL DEFAULT '',
        "subtitle" text,
        "footer_mode" varchar(20) NOT NULL DEFAULT 'LINKSBUDS' CHECK ("footer_mode" IN ('LINKSBUDS', 'CUSTOM', 'HIDDEN')),
        "footer_text" varchar(160),
        "footer_url" text,
        "footer_logo_url" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CHECK (("type" = 'POST') = ("parent_page_id" IS NOT NULL))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_pages_company_id" ON "link_pages" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_link_pages_slug_active" ON "link_pages" ("slug") WHERE "parent_page_id" IS NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_link_pages_post_slug_active" ON "link_pages" ("parent_page_id", "slug") WHERE "parent_page_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_link_pages_company_agency_active" ON "link_pages" ("company_id") WHERE "type" = 'AGENCY' AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_link_pages_public_slug_active" ON "link_pages" ("slug") WHERE "parent_page_id" IS NULL AND "status" = 'ACTIVE' AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_page_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "link_page_id" uuid NOT NULL REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "placement" varchar(20) NOT NULL CHECK ("placement" IN ('HORIZONTAL', 'VERTICAL')),
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('LINK', 'CONTACT')),
        "label" varchar(120) NOT NULL,
        "url" text,
        "contact_type" varchar(20) CHECK ("contact_type" IS NULL OR "contact_type" IN ('WHATSAPP', 'EMAIL', 'PHONE')),
        "contact_value" varchar(180),
        "text_color" varchar(7) NOT NULL,
        "background_color" varchar(7) NOT NULL,
        "border_color" varchar(7) NOT NULL,
        "border_enabled" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CHECK (
          ("kind" = 'LINK' AND "url" IS NOT NULL AND "contact_type" IS NULL AND "contact_value" IS NULL)
          OR ("kind" = 'CONTACT' AND "url" IS NULL AND "contact_type" IS NOT NULL AND "contact_value" IS NOT NULL)
        ),
        CHECK (
          "text_color" ~ '^#[0-9A-Fa-f]{6}$'
          AND "background_color" ~ '^#[0-9A-Fa-f]{6}$'
          AND "border_color" ~ '^#[0-9A-Fa-f]{6}$'
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_links_public_page_sort" ON "link_page_links" ("link_page_id", "placement", "sort_order", "created_at") WHERE "active" = true AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_page_social_links" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "link_page_id" uuid NOT NULL REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "platform" varchar(20) NOT NULL CHECK ("platform" IN ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X', 'WHATSAPP', 'GITHUB', 'PINTEREST')),
        "url" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_social_links_public_page_sort" ON "link_page_social_links" ("link_page_id", "sort_order", "created_at") WHERE "active" = true AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_page_images" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "link_page_id" uuid NOT NULL REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "image_url" text NOT NULL,
        "alt_text" varchar(180),
        "target_url" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_images_public_page_sort" ON "link_page_images" ("link_page_id", "sort_order", "created_at") WHERE "active" = true AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_page_analytics_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" varchar(120),
        "link_page_id" uuid NOT NULL REFERENCES "link_pages"("id") ON DELETE CASCADE,
        "event_type" varchar(30) NOT NULL CHECK ("event_type" IN ('PAGE_VIEW', 'PAGE_EXIT', 'LINK_CLICK', 'SOCIAL_CLICK', 'IMAGE_CLICK')),
        "target_type" varchar(30) CHECK ("target_type" IS NULL OR "target_type" IN ('HORIZONTAL_LINK', 'VERTICAL_LINK', 'SOCIAL_LINK', 'IMAGE')),
        "target_id" uuid,
        "visitor_id" varchar(120),
        "session_id" varchar(120),
        "referrer" text,
        "utm_source" varchar(120),
        "utm_medium" varchar(120),
        "utm_campaign" varchar(120),
        "utm_content" varchar(120),
        "utm_term" varchar(120),
        "country_code" varchar(2),
        "device_type" varchar(40),
        "browser" varchar(80),
        "operating_system" varchar(80),
        "duration_ms" integer,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_analytics_events_event_id" ON "link_page_analytics_events" ("event_id") WHERE "event_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_page_event_created" ON "link_page_analytics_events" ("link_page_id", "event_type", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_target_created" ON "link_page_analytics_events" ("target_id", "created_at")`,
    );

    // --- Catalog seed.
    await queryRunner.query(`
      INSERT INTO "plans" ("code", "name", "label", "description", "features", "action_label", "price_cents", "max_client_pages", "max_members", "analytics_tier", "custom_domain", "white_label", "featured", "sort_order")
      VALUES
        ('FREE', 'Grátis', 'Inicial', 'Comece com a página da sua agência no LinkBuds.',
          '["1 página para sua agência", "1 página de cliente", "1 usuário", "Links ilimitados", "Personalização da página", "Métricas básicas de acessos", "Domínio personalizado"]',
          'Começar grátis', 0, 1, 1, 'BASIC', true, false, false, 0),
        ('AGENCY', 'Agência', 'Padrão', 'Gerencie as páginas dos seus clientes em um só lugar.',
          '["1 página para sua agência", "Até 20 páginas de clientes", "Até 5 usuários na equipe", "Métricas detalhadas de acessos", "Tracking de cliques e conversões", "Domínio personalizado", "Remoção da marca LinkBuds"]',
          'Assinar Agência', 18000, 20, 5, 'FULL', true, true, true, 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'link_page_analytics_events',
      'link_page_images',
      'link_page_social_links',
      'link_page_links',
      'link_pages',
      'company_domains',
      'company_invites',
      'company_conditions',
      'users',
      'company',
      'plans',
      'verification',
      'session',
      'account',
      'user',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }
}
