import { AllowReusingDeletedCompanyDomainHostnames1786654500000 } from '../migrations/1786654500000-AllowReusingDeletedCompanyDomainHostnames';

describe('AllowReusingDeletedCompanyDomainHostnames1786654500000', () => {
  it('replaces the global hostname unique constraint with an active-only unique index', async () => {
    const migration =
      new AllowReusingDeletedCompanyDomainHostnames1786654500000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'DROP CONSTRAINT IF EXISTS "UQ_company_domains_hostname"',
      ),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_company_domains_hostname_active"',
      ),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE "deleted_at" IS NULL'),
    );
  });
});
