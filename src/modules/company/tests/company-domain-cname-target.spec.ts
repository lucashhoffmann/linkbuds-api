import { getCustomDomainCnameTarget } from '../application/company-domain-cname-target';

describe('getCustomDomainCnameTarget', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CUSTOM_DOMAIN_CNAME_TARGET;
    delete process.env.PUBLIC_WEB_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses an explicit custom domain CNAME target when configured', () => {
    process.env.CUSTOM_DOMAIN_CNAME_TARGET = 'https://custom.linkbuds.com/';

    expect(getCustomDomainCnameTarget()).toBe('custom.linkbuds.com');
  });

  it('falls back to the public web hostname when it is not localhost', () => {
    process.env.PUBLIC_WEB_URL = 'https://app.linkbuds.com';

    expect(getCustomDomainCnameTarget()).toBe('app.linkbuds.com');
  });

  it('never returns the old placeholder when local envs are missing', () => {
    process.env.PUBLIC_WEB_URL = 'http://localhost:5173';

    expect(getCustomDomainCnameTarget()).toBe('linkbuds.com');
  });
});
