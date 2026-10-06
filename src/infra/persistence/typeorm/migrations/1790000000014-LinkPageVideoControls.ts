import { MigrationInterface, QueryRunner } from 'typeorm';

/** Show/hide the player controls of a video block. */
export class LinkPageVideoControls1790000000014 implements MigrationInterface {
  name = 'LinkPageVideoControls1790000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_videos" ADD "controls" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_page_videos" DROP COLUMN "controls"`,
    );
  }
}
