import { UseBetterAuth1786654600000 } from '../migrations/1786654600000-UseBetterAuth';

describe('UseBetterAuth1786654600000', () => {
  it('creates Better Auth tables and migrates existing credentials', async () => {
    const migration = new UseBetterAuth1786654600000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await migration.up(queryRunner as never);

    const queries = queryRunner.query.mock.calls
      .map(([sql]) => String(sql))
      .join('\n');

    expect(queries).toContain('CREATE TABLE "user"');
    expect(queries).toContain('CREATE TABLE "account"');
    expect(queries).toContain('CREATE TABLE "session"');
    expect(queries).toContain('CREATE TABLE "verification"');
    expect(queries).toContain('FROM "users"');
    expect(queries).toContain("'credential'");
  });
});
