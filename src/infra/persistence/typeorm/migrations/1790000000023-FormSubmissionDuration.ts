import { MigrationInterface, QueryRunner } from 'typeorm';

/** Time (ms) between opening the form page and submitting it. */
export class FormSubmissionDuration1790000000023 implements MigrationInterface {
  name = 'FormSubmissionDuration1790000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" ADD "duration_ms" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" DROP COLUMN "duration_ms"`,
    );
  }
}
