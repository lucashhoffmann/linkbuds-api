import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkPagesV11786650000000 implements MigrationInterface {
  name = 'LinkPagesV11786650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plans"
        ADD COLUMN "analytics_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN "custom_domain_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN "white_label_enabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE "plans"
      SET
        "analytics_enabled" = CASE WHEN "code" = 'AGENCY' THEN true ELSE "analytics_enabled" END,
        "custom_domain_enabled" = CASE WHEN "code" = 'AGENCY' THEN true ELSE "custom_domain_enabled" END,
        "white_label_enabled" = CASE WHEN "code" = 'AGENCY' THEN true ELSE "white_label_enabled" END
      WHERE "code" IN ('FREE', 'AGENCY')
    `);

    await queryRunner.query(`
      ALTER TABLE "link_pages"
        ADD COLUMN "layout" character varying(20) NOT NULL DEFAULT 'LAYOUT_1',
        ADD COLUMN "background_type" character varying(20) NOT NULL DEFAULT 'SOLID',
        ADD COLUMN "background_color" character varying(7) NOT NULL DEFAULT '#FFFFFF',
        ADD COLUMN "background_image_url" text,
        ADD COLUMN "avatar_url" text,
        ADD COLUMN "title" character varying(140) NOT NULL DEFAULT '',
        ADD COLUMN "subtitle" text,
        ADD COLUMN "footer_mode" character varying(20) NOT NULL DEFAULT 'LINKSBUDS',
        ADD COLUMN "footer_text" character varying(160),
        ADD COLUMN "footer_url" text,
        ADD COLUMN "footer_logo_url" text,
        ADD CONSTRAINT "CHK_link_pages_layout" CHECK ("layout" IN ('LAYOUT_1', 'LAYOUT_2', 'LAYOUT_3')),
        ADD CONSTRAINT "CHK_link_pages_background_type" CHECK ("background_type" IN ('SOLID', 'IMAGE')),
        ADD CONSTRAINT "CHK_link_pages_footer_mode" CHECK ("footer_mode" IN ('LINKSBUDS', 'CUSTOM', 'HIDDEN')),
        ADD CONSTRAINT "CHK_link_pages_background_color_hex" CHECK ("background_color" ~ '^#[0-9A-Fa-f]{6}$')
    `);

    await queryRunner.query(`
      CREATE TABLE "link_page_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "link_page_id" uuid NOT NULL,
        "placement" character varying(20) NOT NULL,
        "kind" character varying(20) NOT NULL,
        "label" character varying(120) NOT NULL,
        "url" text,
        "contact_type" character varying(20),
        "contact_value" character varying(180),
        "text_color" character varying(7) NOT NULL,
        "background_color" character varying(7) NOT NULL,
        "border_color" character varying(7) NOT NULL,
        "border_enabled" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_link_page_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_link_page_links_link_page_id" FOREIGN KEY ("link_page_id") REFERENCES "link_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_link_page_links_placement" CHECK ("placement" IN ('HORIZONTAL', 'VERTICAL')),
        CONSTRAINT "CHK_link_page_links_kind" CHECK ("kind" IN ('LINK', 'CONTACT')),
        CONSTRAINT "CHK_link_page_links_contact_type" CHECK ("contact_type" IS NULL OR "contact_type" IN ('WHATSAPP', 'EMAIL', 'PHONE')),
        CONSTRAINT "CHK_link_page_links_kind_payload" CHECK (
          ("kind" = 'LINK' AND "url" IS NOT NULL AND "contact_type" IS NULL AND "contact_value" IS NULL)
          OR
          ("kind" = 'CONTACT' AND "url" IS NULL AND "contact_type" IS NOT NULL AND "contact_value" IS NOT NULL)
        ),
        CONSTRAINT "CHK_link_page_links_colors_hex" CHECK (
          "text_color" ~ '^#[0-9A-Fa-f]{6}$'
          AND "background_color" ~ '^#[0-9A-Fa-f]{6}$'
          AND "border_color" ~ '^#[0-9A-Fa-f]{6}$'
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_links_page_placement_sort" ON "link_page_links" ("link_page_id", "placement", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_page_social_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "link_page_id" uuid NOT NULL,
        "platform" character varying(20) NOT NULL,
        "url" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_link_page_social_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_link_page_social_links_link_page_id" FOREIGN KEY ("link_page_id") REFERENCES "link_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_link_page_social_links_platform" CHECK ("platform" IN ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'X', 'WHATSAPP', 'GITHUB', 'PINTEREST'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_social_links_page_sort" ON "link_page_social_links" ("link_page_id", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_page_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "link_page_id" uuid NOT NULL,
        "image_url" text NOT NULL,
        "alt_text" character varying(180),
        "target_url" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_link_page_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_link_page_images_link_page_id" FOREIGN KEY ("link_page_id") REFERENCES "link_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_images_page_sort" ON "link_page_images" ("link_page_id", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE "company_domains" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "hostname" character varying(253) NOT NULL,
        "status" character varying(20) NOT NULL,
        "verification_token" character varying(160) NOT NULL,
        "verified_at" TIMESTAMP,
        "last_checked_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_company_domains_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_company_domains_hostname" UNIQUE ("hostname"),
        CONSTRAINT "FK_company_domains_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_company_domains_status" CHECK ("status" IN ('PENDING', 'VERIFIED', 'ACTIVE', 'FAILED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_company_domains_company_id" ON "company_domains" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_company_domains_company_active" ON "company_domains" ("company_id") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "link_page_analytics_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "link_page_id" uuid NOT NULL,
        "event_type" character varying(30) NOT NULL,
        "target_type" character varying(30),
        "target_id" uuid,
        "visitor_id" character varying(120),
        "session_id" character varying(120),
        "referrer" text,
        "utm_source" character varying(120),
        "utm_medium" character varying(120),
        "utm_campaign" character varying(120),
        "utm_content" character varying(120),
        "utm_term" character varying(120),
        "country_code" character varying(2),
        "device_type" character varying(40),
        "browser" character varying(80),
        "operating_system" character varying(80),
        "duration_ms" integer,
        "metadata" jsonb DEFAULT null,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_link_page_analytics_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_link_page_analytics_events_link_page_id" FOREIGN KEY ("link_page_id") REFERENCES "link_pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "CHK_link_page_analytics_events_event_type" CHECK ("event_type" IN ('PAGE_VIEW', 'PAGE_EXIT', 'LINK_CLICK', 'SOCIAL_CLICK', 'IMAGE_CLICK')),
        CONSTRAINT "CHK_link_page_analytics_events_target_type" CHECK ("target_type" IS NULL OR "target_type" IN ('HORIZONTAL_LINK', 'VERTICAL_LINK', 'SOCIAL_LINK', 'IMAGE'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_page_created" ON "link_page_analytics_events" ("link_page_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_page_event_created" ON "link_page_analytics_events" ("link_page_id", "event_type", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_target_created" ON "link_page_analytics_events" ("target_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_visitor_id" ON "link_page_analytics_events" ("visitor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_session_id" ON "link_page_analytics_events" ("session_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_analytics_events_session_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_analytics_events_visitor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_analytics_events_target_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_analytics_events_page_event_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_analytics_events_page_created"`,
    );
    await queryRunner.query(`DROP TABLE "link_page_analytics_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_company_domains_company_active"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_company_domains_company_id"`,
    );
    await queryRunner.query(`DROP TABLE "company_domains"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_link_page_images_page_sort"`,
    );
    await queryRunner.query(`DROP TABLE "link_page_images"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_link_page_social_links_page_sort"`,
    );
    await queryRunner.query(`DROP TABLE "link_page_social_links"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_link_page_links_page_placement_sort"`,
    );
    await queryRunner.query(`DROP TABLE "link_page_links"`);
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        DROP CONSTRAINT "CHK_link_pages_background_color_hex",
        DROP CONSTRAINT "CHK_link_pages_footer_mode",
        DROP CONSTRAINT "CHK_link_pages_background_type",
        DROP CONSTRAINT "CHK_link_pages_layout",
        DROP COLUMN "footer_logo_url",
        DROP COLUMN "footer_url",
        DROP COLUMN "footer_text",
        DROP COLUMN "footer_mode",
        DROP COLUMN "subtitle",
        DROP COLUMN "title",
        DROP COLUMN "avatar_url",
        DROP COLUMN "background_image_url",
        DROP COLUMN "background_color",
        DROP COLUMN "background_type",
        DROP COLUMN "layout"
    `);
    await queryRunner.query(`
      ALTER TABLE "plans"
        DROP COLUMN "white_label_enabled",
        DROP COLUMN "custom_domain_enabled",
        DROP COLUMN "analytics_enabled"
    `);
  }
}
