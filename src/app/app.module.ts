import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from 'src/shared/errors/all-exceptions.filter';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { TYPEORM_MIGRATIONS_GLOB } from 'src/infra/persistence/typeorm/typeorm-paths';
import * as Modules from 'src/modules';

const modulesArray = Object.values(Modules);

// Schema comes only from migrations: synchronize skips triggers, partial
// indexes and the better-auth tables, and leaves migration history empty.
function resolveTypeOrmOptions(): TypeOrmModuleOptions {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  return {
    type: 'postgres',
    url,
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
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
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
