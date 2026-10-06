import { MigrationInterface, QueryRunner } from 'typeorm';

/** Card fee passed to the payer, kept so the history can show the breakdown. */
export class BillingFeeCents1790000000008 implements MigrationInterface {
  name = 'BillingFeeCents1790000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['subscriptions', 'billing_checkouts']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "fee_cents" integer NOT NULL DEFAULT 0 CONSTRAINT "CHK_${table}_fee_cents" CHECK ("fee_cents" >= 0)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['subscriptions', 'billing_checkouts']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "fee_cents"`);
    }
  }
}
