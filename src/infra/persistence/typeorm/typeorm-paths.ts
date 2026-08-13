import { resolve } from 'node:path';

export const TYPEORM_ENTITIES_GLOB = resolve(
  __dirname,
  '../../../modules/**/*.entity.{ts,js}',
);

export const TYPEORM_MIGRATIONS_GLOB = resolve(
  __dirname,
  'migrations/*.{ts,js}',
);
