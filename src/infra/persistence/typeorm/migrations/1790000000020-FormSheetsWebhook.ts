import { MigrationInterface, QueryRunner } from 'typeorm';

/** Google Sheets via Apps Script: webhook URL per form + delivery mark per submission. */
export class FormSheetsWebhook1790000000020 implements MigrationInterface {
  name = 'FormSheetsWebhook1790000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        ADD "form_webhook_url" text,
        ADD CONSTRAINT "CHK_link_pages_form_webhook_url" CHECK ("form_webhook_url" IS NULL OR "type" = 'FORM')
    `);
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" ADD "webhook_delivered_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" DROP COLUMN "webhook_delivered_at"`,
    );
    await queryRunner.query(`
      ALTER TABLE "link_pages"
        DROP CONSTRAINT "CHK_link_pages_form_webhook_url",
        DROP COLUMN "form_webhook_url"
    `);
  }
}
