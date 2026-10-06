import { MigrationInterface, QueryRunner } from 'typeorm';

/** Questionnaire score per answer (null = form only collects). */
export class FormSubmissionScore1790000000025 implements MigrationInterface {
  name = 'FormSubmissionScore1790000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" ADD "score" integer, ADD "score_max" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" DROP COLUMN "score_max", DROP COLUMN "score"`,
    );
  }
}
