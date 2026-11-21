import { sql } from 'drizzle-orm';
import type { Db } from '../db/database.js';
import { migrateToLatest } from '../db/migrate.js';
import { configureAiReader } from '../db/roles.js';

/** A fixed password for the throwaway test cluster's reader role; never used anywhere real. */
export const TEST_AI_READER_PASSWORD = 'acme-ai-reader-test-only-0000';

/** Drops and recreates the schema. Only for throwaway test databases. */
export async function resetSchema(owner: Db): Promise<void> {
  await owner.execute(sql`drop schema if exists drizzle cascade`);
  await owner.execute(sql`drop schema if exists app_private cascade`);
  await owner.execute(sql`drop schema public cascade`);
  await owner.execute(sql`create schema public`);
}

/** Drops and recreates the schema, then migrates. Only for throwaway test databases. */
export async function resetAndMigrate(owner: Db): Promise<void> {
  await resetSchema(owner);
  await migrateToLatest(owner);
}

/**
 * Lets `acme_ai_reader` log in with the test password and returns its connection string, plus a
 * function that puts the previous password back. Roles are cluster-wide, so on a laptop where the
 * dev database shares the cluster this keeps the dev DATABASE_URL_AI working after the tests
 * (restoring needs a superuser, as in the local and CI Postgres).
 */
export async function enableTestAiReader(
  owner: Db,
  ownerUrl: string,
): Promise<{ url: string; restore: () => Promise<void> }> {
  let previous: string | null = null;
  try {
    const { rows } = await owner.execute<{ password: string | null }>(
      sql`select rolpassword as password from pg_authid where rolname = 'acme_ai_reader'`,
    );
    previous = rows[0]?.password ?? null;
  } catch {
    previous = null; // not a superuser: nothing to restore
  }
  await configureAiReader(owner, TEST_AI_READER_PASSWORD);
  const url = new URL(ownerUrl);
  url.username = 'acme_ai_reader';
  url.password = TEST_AI_READER_PASSWORD;
  return {
    url: url.toString(),
    restore: async () => {
      if (previous && /^SCRAM-SHA-256\$[A-Za-z0-9+/=$:]+$/.test(previous)) {
        await owner.execute(sql.raw(`alter role acme_ai_reader password '${previous}'`));
      }
    },
  };
}
