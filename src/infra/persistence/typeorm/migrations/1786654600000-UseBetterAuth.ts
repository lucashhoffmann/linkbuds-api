import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseBetterAuth1786654600000 implements MigrationInterface {
  name = 'UseBetterAuth1786654600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "image" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_better_auth_user_email" UNIQUE ("email"),
        CONSTRAINT "PK_better_auth_user_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "account" (
        "id" text NOT NULL,
        "accountId" text NOT NULL,
        "providerId" text NOT NULL,
        "userId" text NOT NULL,
        "accessToken" text,
        "refreshToken" text,
        "idToken" text,
        "accessTokenExpiresAt" TIMESTAMP,
        "refreshTokenExpiresAt" TIMESTAMP,
        "scope" text,
        "password" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_better_auth_account_provider_account" UNIQUE ("providerId", "accountId"),
        CONSTRAINT "PK_better_auth_account_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_better_auth_account_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "session" (
        "id" text NOT NULL,
        "userId" text NOT NULL,
        "token" text NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "ipAddress" text,
        "userAgent" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_better_auth_session_token" UNIQUE ("token"),
        CONSTRAINT "PK_better_auth_session_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_better_auth_session_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "verification" (
        "id" text NOT NULL,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_better_auth_verification_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_better_auth_account_userId" ON "account" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_better_auth_session_userId" ON "session" ("userId")`,
    );

    await queryRunner.query(`
      INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      SELECT "id"::text, "name", "email", false, "created_at", "updated_at"
      FROM "users"
      WHERE "deleted_at" IS NULL
      ON CONFLICT ("email") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
      SELECT uuid_generate_v4()::text, "id"::text, 'credential', "id"::text, "password", "created_at", "updated_at"
      FROM "users"
      WHERE "deleted_at" IS NULL
      ON CONFLICT ("providerId", "accountId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_better_auth_session_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_better_auth_account_userId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "verification"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "session"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
  }
}
