import { EnableCustomDomainsForFreePlans1786654400000 } from '../migrations/1786654400000-EnableCustomDomainsForFreePlans';

describe('EnableCustomDomainsForFreePlans1786654400000', () => {
  it('enables custom domains for existing free, agency and custom plans', async () => {
    const migration = new EnableCustomDomainsForFreePlans1786654400000();
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await migration.up(queryRunner as never);

    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(`SET "custom_domain_enabled" = true`),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(`"type" IN ('FREE', 'AGENCY', 'CUSTOM')`),
    );
    expect(queryRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(`"code" IN ('FREE', 'AGENCY')`),
    );
  });
});
