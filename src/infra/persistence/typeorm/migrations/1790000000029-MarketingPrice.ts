import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marketing R$ 149 → R$ 119: at R$ 149 it sat R$ 31 below Agência (+20 clients,
 * +2 seats, white-label), so nobody picked it. Per client still drops as the
 * plan grows: Digital R$ 5,90 > Marketing R$ 3,97 > Agência R$ 3,60.
 * Live subscriptions keep the value contracted at the gateway; only new
 * checkouts see R$ 119.
 */
export class MarketingPrice1790000000029 implements MigrationInterface {
  name = 'MarketingPrice1790000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plans" SET "price_cents" = 11900 WHERE "code" = 'MARKETING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "plans" SET "price_cents" = 14900 WHERE "code" = 'MARKETING'`,
    );
  }
}
