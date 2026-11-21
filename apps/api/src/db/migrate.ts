import { fileURLToPath, pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, describeError, requireEnv, type Db } from './database.js';

/** The SQL migrations drizzle-kit writes (apps/api/drizzle), found from src/ and from dist/. */
export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Applies every pending migration, in order, in one transaction. */
export async function migrateToLatest(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}

async function main() {
  // Runs as the owner role (DATABASE_URL_MIGRATOR), never as the app role.
  const db = createDb(requireEnv('DATABASE_URL_MIGRATOR'), { max: 1 });
  try {
    await migrateToLatest(db);
    console.log('Database is up to date.');
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

// Run only as a script, not when a test imports migrateToLatest.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
