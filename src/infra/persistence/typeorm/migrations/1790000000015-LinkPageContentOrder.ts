import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links, images and videos now share one `sort_order` space per page.
 * Shift existing images/videos after the page's links (images, then videos),
 * which is how most layouts showed them before.
 */
export class LinkPageContentOrder1790000000015 implements MigrationInterface {
  name = 'LinkPageContentOrder1790000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "link_page_images" i
      SET "sort_order" = i."sort_order" + COALESCE((
        SELECT MAX(l."sort_order") + 1 FROM "link_page_links" l
        WHERE l."link_page_id" = i."link_page_id"
      ), 0)
    `);
    await queryRunner.query(`
      UPDATE "link_page_videos" v
      SET "sort_order" = v."sort_order" + GREATEST(
        COALESCE((
          SELECT MAX(l."sort_order") + 1 FROM "link_page_links" l
          WHERE l."link_page_id" = v."link_page_id"
        ), 0),
        COALESCE((
          SELECT MAX(i."sort_order") + 1 FROM "link_page_images" i
          WHERE i."link_page_id" = v."link_page_id"
        ), 0)
      )
    `);
  }

  public async down(): Promise<void> {
    // Order-only data change: the shifted values stay valid for the old per-type order.
  }
}
