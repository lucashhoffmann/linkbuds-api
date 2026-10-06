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

describe('reset password email', () => {
  it('logs instead of sending when RESEND_API_KEY is unset (dev)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const options = buildBetterAuthOptions(baseEnv);

    await options.emailAndPassword.sendResetPassword({
      user: { id: '1', name: 'Ana', email: 'ana@x.com' },
      url: 'http://localhost:3030/api/auth/reset-password/tok',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('refuses to silently drop emails in production', async () => {
    const options = buildBetterAuthOptions({
      ...baseEnv,
      NODE_ENV: 'production',
    });

    await expect(
      options.emailAndPassword.sendResetPassword({
        user: { id: '1', name: 'Ana', email: 'ana@x.com' },
        url: 'http://x/reset',
      }),
    ).rejects.toThrow('RESEND_API_KEY');
  });
});
