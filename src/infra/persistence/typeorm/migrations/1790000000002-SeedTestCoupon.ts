import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TEMPORARY test coupon: unlocks everything for free (AGENCY plan, high
 * limits, all features, price 0, no expiry).
 *
 * To remove after testing (docs/monetizacao.md):
 *   - stop new redemptions:  PATCH /admin/coupons/LIBERATUDO {"active": false}
 *   - and/or revoke grants:  DELETE /admin/conditions/:id for each redemption
 *   - or drop it entirely:   remove the LIBERATUDO row from coupons (after the steps above)
 */
export class SeedTestCoupon1790000000002 implements MigrationInterface {
  name = 'SeedTestCoupon1790000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "coupons" ("code", "description", "plan_id", "max_client_pages", "max_members", "price_cents", "analytics_tier", "custom_domain", "white_label")
      SELECT 'LIBERATUDO', 'Cupom de teste: libera tudo de graça. Remover após os testes.', "id", 1000, 50, 0, 'FULL', true, true
      FROM "plans" WHERE "code" = 'AGENCY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Conditions granted by it lose the coupon link (ON DELETE SET NULL) but stay revocable.
    await queryRunner.query(
      `DELETE FROM "coupons" WHERE "code" = 'LIBERATUDO'`,
    );
  }
}
