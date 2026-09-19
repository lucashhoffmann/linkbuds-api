import { buildBetterAuthOptions } from '../infra/better-auth.config';

const baseEnv = {
  BETTER_AUTH_URL: 'http://localhost:3030',
  BETTER_AUTH_SECRET: 'test-secret',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/linkbuds',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('buildBetterAuthOptions', () => {
  it('keeps Google disabled by default', () => {
    const options = buildBetterAuthOptions(baseEnv);

    expect(options.basePath).toBe('/api/auth');
    expect(options.socialProviders).toBeUndefined();
  });

  it('configures Google when enabled', () => {
    const options = buildBetterAuthOptions({
      ...baseEnv,
      GOOGLE_AUTH_ENABLED: 'true',
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
    });

    expect(options.socialProviders).toEqual({
      google: {
        clientId: 'google-client',
        clientSecret: 'google-secret',
      },
    });
  });
});
