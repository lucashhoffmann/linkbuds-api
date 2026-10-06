import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Forms become a plan quota (`max_forms`) and two cheaper tiers sit between
 * FREE and AGENCY. Price per client page grows as the plan shrinks
 * (Digital R$ 11,80 > Marketing R$ 10,90 > Agência R$ 9,00), so stacking
 * small plans never beats upgrading.
 */
export class PlanFormsAndTiers1790000000021 implements MigrationInterface {
  name = 'PlanFormsAndTiers1790000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "plans" ADD "max_forms" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_conditions" ADD "max_forms" integer`,
    );

    await queryRunner.query(`
      UPDATE "plans" SET "max_forms" = 1,
        "features" = '["1 página para sua agência", "1 página de cliente", "1 usuário", "1 formulário", "Links ilimitados", "Personalização da página", "Métricas básicas de acessos", "Domínio personalizado"]'
      WHERE "code" = 'FREE'
    `);
    await queryRunner.query(`
      UPDATE "plans" SET "max_forms" = 50, "sort_order" = 3,
        "features" = '["1 página para sua agência", "Até 20 páginas de clientes", "Até 5 usuários na equipe", "Até 50 formulários", "Métricas detalhadas de acessos", "Tracking de cliques e conversões", "Domínio personalizado", "Remoção da marca LinkBuds"]'
      WHERE "code" = 'AGENCY'
    `);

    await queryRunner.query(`
      INSERT INTO "plans" ("code", "name", "label", "description", "features", "action_label", "price_cents", "max_client_pages", "max_members", "max_forms", "analytics_tier", "custom_domain", "white_label", "featured", "sort_order")
      VALUES
        ('DIGITAL', 'Digital', 'Essencial', 'Para quem está começando a atender clientes.',
          '["1 página para sua agência", "Até 5 páginas de clientes", "Até 2 usuários na equipe", "Até 5 formulários", "Métricas básicas de acessos", "Domínio personalizado"]',
          'Assinar Digital', 5900, 5, 2, 5, 'BASIC', true, false, false, 1),
        ('MARKETING', 'Marketing', 'Crescimento', 'Para equipes de marketing com uma carteira em crescimento.',
          '["1 página para sua agência", "Até 10 páginas de clientes", "Até 3 usuários na equipe", "Até 15 formulários", "Métricas detalhadas de acessos", "Tracking de cliques e conversões", "Domínio personalizado"]',
          'Assinar Marketing', 10900, 10, 3, 15, 'FULL', true, false, false, 2)
      ON CONFLICT ("code") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Companies on the new tiers block the delete (FK RESTRICT): move them first.
    await queryRunner.query(
      `DELETE FROM "plans" WHERE "code" IN ('DIGITAL', 'MARKETING')`,
    );
    await queryRunner.query(
      `UPDATE "plans" SET "sort_order" = 1 WHERE "code" = 'AGENCY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_conditions" DROP COLUMN "max_forms"`,
    );
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "max_forms"`);
  }
}
