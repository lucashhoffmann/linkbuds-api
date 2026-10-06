import { MigrationInterface, QueryRunner } from 'typeorm';

/** Brand is "LinkBuds": footer mode LINKSBUDS → LINKBUDS. */
export class RenameFooterBrandMode1790000000003 implements MigrationInterface {
  name = 'RenameFooterBrandMode1790000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.swap(queryRunner, 'LINKSBUDS', 'LINKBUDS');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.swap(queryRunner, 'LINKBUDS', 'LINKSBUDS');
  }

  private async swap(queryRunner: QueryRunner, from: string, to: string) {
    await queryRunner.query(
      `ALTER TABLE "link_pages" DROP CONSTRAINT IF EXISTS "link_pages_footer_mode_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_pages" DROP CONSTRAINT IF EXISTS "CHK_link_pages_footer_mode"`,
    );
    await queryRunner.query(
      `UPDATE "link_pages" SET "footer_mode" = $1 WHERE "footer_mode" = $2`,
      [to, from],
    );
    await queryRunner.query(
      `ALTER TABLE "link_pages" ALTER COLUMN "footer_mode" SET DEFAULT '${to}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_pages" ADD CONSTRAINT "CHK_link_pages_footer_mode" CHECK ("footer_mode" IN ('${to}', 'CUSTOM', 'HIDDEN'))`,
    );
  }
}
