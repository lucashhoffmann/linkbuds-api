import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quotas v2 — clients 2/10/30/50, forms 2/10/20/50 (Grátis/Digital/Marketing/Agência).
 * Price per client still drops as the plan grows (Digital R$ 5,90 > Marketing
 * R$ 4,97 > Agência R$ 3,60), so stacking smaller plans never beats upgrading.
 */
export class PlanQuotasV21790000000022 implements MigrationInterface {
  name = 'PlanQuotasV21790000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 2, "max_forms" = 2,
        "features" = '["1 página para sua agência", "2 páginas de clientes", "1 usuário", "2 formulários", "Links ilimitados", "Personalização da página", "Métricas básicas de acessos", "Domínio personalizado"]'
      WHERE "code" = 'FREE'
    `);
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 10, "max_forms" = 10,
        "features" = '["1 página para sua agência", "Até 10 páginas de clientes", "Até 2 usuários na equipe", "Até 10 formulários", "Métricas básicas de acessos", "Domínio personalizado"]'
      WHERE "code" = 'DIGITAL'
    `);
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 30, "max_forms" = 20, "price_cents" = 14900,
        "features" = '["1 página para sua agência", "Até 30 páginas de clientes", "Até 3 usuários na equipe", "Até 20 formulários", "Métricas detalhadas de acessos", "Tracking de cliques e conversões", "Domínio personalizado"]'
      WHERE "code" = 'MARKETING'
    `);
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 50, "max_forms" = 50,
        "features" = '["1 página para sua agência", "Até 50 páginas de clientes", "Até 5 usuários na equipe", "Até 50 formulários", "Métricas detalhadas de acessos", "Tracking de cliques e conversões", "Domínio personalizado", "Remoção da marca LinkBuds"]'
      WHERE "code" = 'AGENCY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 1, "max_forms" = 1,
        "features" = '["1 página para sua agência", "1 página de cliente", "1 usuário", "1 formulário", "Links ilimitados", "Personalização da página", "Métricas básicas de acessos", "Domínio personalizado"]'
      WHERE "code" = 'FREE'
    `);
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 5, "max_forms" = 5,
        "features" = '["1 página para sua agência", "Até 5 páginas de clientes", "Até 2 usuários na equipe", "Até 5 formulários", "Métricas básicas de acessos", "Domínio personalizado"]'
      WHERE "code" = 'DIGITAL'
    `);
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 10, "max_forms" = 15, "price_cents" = 10900,
        "features" = '["1 página para sua agência", "Até 10 páginas de clientes", "Até 3 usuários na equipe", "Até 15 formulários", "Métricas detalhadas de acessos", "Tracking de cliques e conversões", "Domínio personalizado"]'
      WHERE "code" = 'MARKETING'
    `);
    await queryRunner.query(`
      UPDATE "plans" SET "max_client_pages" = 20, "max_forms" = 50,
        "features" = '["1 página para sua agência", "Até 20 páginas de clientes", "Até 5 usuários na equipe", "Até 50 formulários", "Métricas detalhadas de acessos", "Tracking de cliques e conversões", "Domínio personalizado", "Remoção da marca LinkBuds"]'
      WHERE "code" = 'AGENCY'
    `);
  }
}
