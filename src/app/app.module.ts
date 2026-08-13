import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Client } from 'pg';
import { resolve } from 'node:path';
import { AppController } from './presentation/app.controller';
import { TYPEORM_MIGRATIONS_GLOB } from 'src/infra/persistence/typeorm/typeorm-paths';
import * as Modules from 'src/modules';

const modulesArray = Object.values(Modules);

async function hasPublicTables(url: string): Promise<boolean> {
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    const result = await client.query<{ hasTables: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
      ) AS "hasTables"`,
    );

    return Boolean(result.rows?.[0]?.hasTables);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function resolveTypeOrmOptions(): Promise<TypeOrmModuleOptions> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  const syncEnv = process.env.TYPEORM_SYNC;
  const migrationsRunEnv = process.env.TYPEORM_MIGRATIONS_RUN;
  const shouldRunMigrations = migrationsRunEnv === 'true';

  if (syncEnv === 'true' && shouldRunMigrations) {
    throw new Error(
      'TYPEORM_SYNC and TYPEORM_MIGRATIONS_RUN cannot both be true',
    );
  }

  let synchronize = false;
  let migrationsRun = shouldRunMigrations;

  if (syncEnv === 'true') {
    synchronize = true;
    migrationsRun = false;
  } else if (syncEnv !== 'false' && !shouldRunMigrations) {
    synchronize = !(await hasPublicTables(url));
  }

  return {
    type: 'postgres',
    url,
    autoLoadEntities: true,
    synchronize,
    migrationsRun,
    entities: [],
    migrations: [TYPEORM_MIGRATIONS_GLOB],
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(__dirname, '../../.env'),
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 30000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: resolveTypeOrmOptions,
    }),
    ...modulesArray,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
