import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  TYPEORM_ENTITIES_GLOB,
  TYPEORM_MIGRATIONS_GLOB,
} from './typeorm-paths';

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
