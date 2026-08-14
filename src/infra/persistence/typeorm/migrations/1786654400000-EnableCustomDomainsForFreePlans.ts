import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableCustomDomainsForFreePlans1786654400000
  implements MigrationInterface
{
  name = 'EnableCustomDomainsForFreePlans1786654400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plans"
      SET "custom_domain_enabled" = true
      WHERE "type" IN ('FREE', 'AGENCY', 'CUSTOM')
        OR "code" IN ('FREE', 'AGENCY')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plans"
      SET "custom_domain_enabled" = false
      WHERE "type" = 'FREE'
        OR "code" = 'FREE'
    `);
  }
}
