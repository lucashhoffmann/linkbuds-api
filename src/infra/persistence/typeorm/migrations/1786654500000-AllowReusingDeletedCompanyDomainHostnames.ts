import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowReusingDeletedCompanyDomainHostnames1786654500000
  implements MigrationInterface
{
  name = 'AllowReusingDeletedCompanyDomainHostnames1786654500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_domains"
      DROP CONSTRAINT IF EXISTS "UQ_company_domains_hostname"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_company_domains_hostname_active"
      ON "company_domains" ("hostname")
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_company_domains_hostname_active"`,
    );
    await queryRunner.query(`
      ALTER TABLE "company_domains"
      ADD CONSTRAINT "UQ_company_domains_hostname" UNIQUE ("hostname")
    `);
  }
}
