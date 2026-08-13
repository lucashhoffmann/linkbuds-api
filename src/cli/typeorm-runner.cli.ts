import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  TYPEORM_ENTITIES_GLOB,
  TYPEORM_MIGRATIONS_GLOB,
} from 'src/infra/persistence/typeorm/typeorm-paths';

type Command = 'run' | 'show' | 'revert';

function getCommand(value: string | undefined): Command | null {
  if (value === 'run' || value === 'show' || value === 'revert') {
    return value;
  }

  return null;
}

function createDataSource() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  return new DataSource({
    type: 'postgres',
    url,
    entities: [TYPEORM_ENTITIES_GLOB],
    migrations: [TYPEORM_MIGRATIONS_GLOB],
    synchronize: false,
    migrationsRun: false,
  });
}

async function main() {
  const command = getCommand(process.argv[2]);

  if (!command) {
    console.error(
      'Usage: node dist/cli/typeorm-runner.cli.js <run|show|revert>',
    );
    process.exitCode = 1;
    return;
  }

  const dataSource = createDataSource();
  await dataSource.initialize();

  try {
    if (command === 'run') {
      const migrations = await dataSource.runMigrations();
      console.log(`Applied ${migrations.length} migration(s).`);
      return;
    }

    if (command === 'show') {
      const hasPendingMigrations = await dataSource.showMigrations();
      console.log(
        hasPendingMigrations
          ? 'There are pending migrations.'
          : 'There are no pending migrations.',
      );
      return;
    }

    await dataSource.undoLastMigration();
    console.log('Reverted the last migration.');
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
