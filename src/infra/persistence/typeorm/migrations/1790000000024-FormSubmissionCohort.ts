import { MigrationInterface, QueryRunner } from 'typeorm';

/** Cohort tag per answer: seasonal forms close/reopen and filter by it. */
export class FormSubmissionCohort1790000000024 implements MigrationInterface {
  name = 'FormSubmissionCohort1790000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" ADD "cohort" varchar(60) NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_link_page_form_submissions_page_cohort" ON "link_page_form_submissions" ("link_page_id", "cohort")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_link_page_form_submissions_page_cohort"`,
    );
    await queryRunner.query(
      `ALTER TABLE "link_page_form_submissions" DROP COLUMN "cohort"`,
    );
  }
}
