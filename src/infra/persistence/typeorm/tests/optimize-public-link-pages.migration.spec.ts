import { QueryRunner } from 'typeorm';
import { OptimizePublicLinkPages1786653600000 } from '../migrations/1786653600000-OptimizePublicLinkPages';

describe('OptimizePublicLinkPages1786653600000', () => {
  it('validates duplicate slugs before creating the global public slug index', async () => {
    const migration = new OptimizePublicLinkPages1786653600000();
    const query = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      query,
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    const queries = query.mock.calls.map(([sql]) => String(sql));

    expect(queries[0]).toContain('duplicate non-deleted slug');
    expect(queries.join('\n')).toContain(
      'CREATE UNIQUE INDEX "UQ_link_pages_slug_global_active"',
    );
    expect(queries.join('\n')).toContain('WHERE "deleted_at" IS NULL');
  });
});
