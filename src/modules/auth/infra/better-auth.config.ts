import { Pool } from 'pg';
import * as argon2 from 'argon2';
import type { IncomingHttpHeaders } from 'node:http';
import type { BetterAuthOptions } from 'better-auth';
import { resetPasswordEmail, sendEmail } from './send-email';

export const BETTER_AUTH_BASE_PATH = '/api/auth';

type Env = NodeJS.ProcessEnv;

export type BetterAuthUser = {
  id: string;
  name: string;
  email: string;
};

type BetterAuthSession = {
  user: BetterAuthUser;
};

interface BetterAuthInstance {
  handler(request: Request): Promise<Response>;
  api: {
    getSession(context: {
      headers: Headers;
    }): Promise<BetterAuthSession | null>;
    signUpEmail(context: {
      body: { name: string; email: string; password: string };
    }): Promise<{ user: BetterAuthUser }>;
  };
}

let authPromise: Promise<BetterAuthInstance> | null = null;
let nodeHelpersPromise: Promise<typeof import('better-auth/node')> | null =
  null;

function getRequiredEnv(env: Env, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

function getEnvOrDefault(env: Env, key: string, fallback: string): string {
  const value = env[key]?.trim();

  if (value) {
    return value;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error(`${key} is not set`);
  }

  return fallback;
}

function parseCsv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isEnabled(value?: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (value ?? '').trim().toLowerCase(),
  );
}

function buildSocialProviders(
  env: Env,
): BetterAuthOptions['socialProviders'] | undefined {
  if (!isEnabled(env.GOOGLE_AUTH_ENABLED)) {
    return undefined;
  }

  return {
    google: {
      clientId: getRequiredEnv(env, 'GOOGLE_CLIENT_ID'),
      clientSecret: getRequiredEnv(env, 'GOOGLE_CLIENT_SECRET'),
    },
  };
}

export function buildBetterAuthOptions(env: Env = process.env) {
  const socialProviders = buildSocialProviders(env);

  return {
    appName: 'LinkBuds',
    basePath: BETTER_AUTH_BASE_PATH,
    baseURL: getEnvOrDefault(
      env,
      'BETTER_AUTH_URL',
      `http://localhost:${env.PORT || 3030}`,
    ),
    secret: getEnvOrDefault(
      env,
      'BETTER_AUTH_SECRET',
      'dev-only-secret-change-me',
    ),
    database: new Pool({
      connectionString: getRequiredEnv(env, 'DATABASE_URL'),
      allowExitOnIdle: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({
        user,
        url,
      }: {
        user: BetterAuthUser;
        url: string;
      }) => sendEmail(resetPasswordEmail(user.email, url), env),
      password: {
        hash: (password: string) => argon2.hash(password),
        verify: ({ hash, password }: { hash: string; password: string }) =>
          argon2.verify(hash, password),
      },
    },
    trustedOrigins: parseCsv(env.CORS_ORIGIN),
    ...(socialProviders ? { socialProviders } : {}),
  } satisfies BetterAuthOptions;
}

export async function createBetterAuthInstance(env: Env = process.env) {
  const { betterAuth } = await import('better-auth');

  return betterAuth(buildBetterAuthOptions(env));
}

export async function getBetterAuth(): Promise<BetterAuthInstance> {
  authPromise ??= createBetterAuthInstance().then(
    (instance) => instance as BetterAuthInstance,
  );

  return authPromise;
}

export async function toBetterAuthHeaders(
  headers: IncomingHttpHeaders,
): Promise<Headers> {
  nodeHelpersPromise ??= import('better-auth/node');
  const { fromNodeHeaders } = await nodeHelpersPromise;

  return fromNodeHeaders(headers);
}

export function resetBetterAuthForTests() {
  authPromise = null;
  nodeHelpersPromise = null;
}
