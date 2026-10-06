import { MigrationInterface, QueryRunner } from 'typeorm';

/** Yearly plans paid in card installments, renewed with the card token. */
export class BillingInstallments1790000000007 implements MigrationInterface {
  name = 'BillingInstallments1790000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['subscriptions', 'billing_checkouts']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "installment_count" integer NOT NULL DEFAULT 1 CONSTRAINT "CHK_${table}_installment_count" CHECK ("installment_count" BETWEEN 1 AND 12), ADD "provider_card_token" varchar(160)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['subscriptions', 'billing_checkouts']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "installment_count", DROP COLUMN "provider_card_token"`,
      );
    }
  }
}
