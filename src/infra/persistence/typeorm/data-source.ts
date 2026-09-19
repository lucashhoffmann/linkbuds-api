import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import {
  TYPEORM_ENTITIES_GLOB,
  TYPEORM_MIGRATIONS_GLOB,
} from './typeorm-paths';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFile();

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set');
}

export default new DataSource({
  type: 'postgres',
  url,
  entities: [TYPEORM_ENTITIES_GLOB],
  migrations: [TYPEORM_MIGRATIONS_GLOB],
  synchronize: false,
  migrationsRun: false,
});
