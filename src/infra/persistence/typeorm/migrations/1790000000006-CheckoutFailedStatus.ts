import { MigrationInterface, QueryRunner } from 'typeorm';

/** Transparent checkout: a refused card leaves the checkout FAILED. */
export class CheckoutFailedStatus1790000000006 implements MigrationInterface {
  name = 'CheckoutFailedStatus1790000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "billing_checkouts" DROP CONSTRAINT IF EXISTS "billing_checkouts_status_check", ADD CONSTRAINT "CHK_billing_checkouts_status" CHECK ("status" IN ('OPEN', 'COMPLETED', 'EXPIRED', 'FAILED'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "billing_checkouts" SET "status" = 'EXPIRED' WHERE "status" = 'FAILED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "billing_checkouts" DROP CONSTRAINT "CHK_billing_checkouts_status", ADD CONSTRAINT "billing_checkouts_status_check" CHECK ("status" IN ('OPEN', 'COMPLETED', 'EXPIRED'))`,
    );
  }
}
