import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateParameters1786644290392 implements MigrationInterface {
  name = 'CreateParameters1786644290392';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "parameters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "feature" character varying(100) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT false,
        "expires_at" TIMESTAMP,
        "accounts_uuids" json DEFAULT null,
        "payload" jsonb DEFAULT null,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "UQ_parameters_feature" UNIQUE ("feature"),
        CONSTRAINT "PK_parameters_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_parameters_feature" ON "parameters" ("feature")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_parameters_feature"`);
    await queryRunner.query(`DROP TABLE "parameters"`);
  }
}
