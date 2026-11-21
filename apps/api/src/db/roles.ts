import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
import { createDb, describeError, requireEnv, type Db } from './database.js';

/**
 * `npm run db:roles`: turns on LOGIN for `acme_ai_reader` (created NOLOGIN by migration 0007)
 * with the password in ACME_AI_READER_PASSWORD, and re-applies its safety settings. Runs as the
 * migrator (DATABASE_URL_MIGRATOR); run it after `db:migrate` and whenever the password rotates.
 *
 * The password never reaches the server in clear text: it is turned into a SCRAM-SHA-256 verifier
 * here, and only the verifier is sent, so it cannot show up in the server's statement log.
 */

const ITERATIONS = 4096;

/** A SCRAM-SHA-256 verifier in Postgres' stored format (RFC 5802 / 7677). */
export function scramVerifier(password: string, salt = randomBytes(16)): string {
  const salted = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', salted).update('Server Key').digest();
  return `SCRAM-SHA-256$${ITERATIONS}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}

/** Printable ASCII only, so no SASLprep normalisation is needed; at least 16 characters. */
export function assertUsablePassword(password: string): void {
  if (password.length < 16 || !/^[\x21-\x7e]+$/.test(password)) {
    throw new Error(
      'ACME_AI_READER_PASSWORD must be at least 16 printable ASCII characters without spaces',
    );
  }
}

/** Sets LOGIN, the password and the role's limits. The role must exist (migration 0007). */
export async function configureAiReader(db: Db, password: string): Promise<void> {
  assertUsablePassword(password);
  const { rows } = await db.execute<{
    rolsuper: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
  }>(
    sql`select rolsuper, rolreplication, rolbypassrls from pg_roles where rolname = 'acme_ai_reader'`,
  );
  const role = rows[0];
  if (!role) {
    throw new Error('Role acme_ai_reader does not exist. Run `npm run db:migrate` first.');
  }
  // Only a superuser may name SUPERUSER, REPLICATION or BYPASSRLS in ALTER ROLE, even to turn them
  // off (managed hosts such as Render give no superuser). Migration 0007 creates the role without
  // them and a non-superuser can't add them, so they are checked here instead of set.
  if (role.rolsuper || role.rolreplication || role.rolbypassrls) {
    throw new Error('acme_ai_reader must not be a superuser or have REPLICATION or BYPASSRLS');
  }
  const verifier = scramVerifier(password);
  // The verifier is base64 and `$:` only, so quoting it as a literal is safe.
  if (!/^[A-Za-z0-9+/=$:-]+$/.test(verifier)) throw new Error('Unexpected verifier format');
  await db.execute(
    sql.raw(
      `alter role acme_ai_reader with login nocreatedb nocreaterole noinherit connection limit 4 password '${verifier}'`,
    ),
  );
  await db.execute(sql`alter role acme_ai_reader set default_transaction_read_only = on`);
  await db.execute(sql`alter role acme_ai_reader set statement_timeout = '5s'`);
  await db.execute(sql`alter role acme_ai_reader set idle_in_transaction_session_timeout = '10s'`);
}

async function main() {
  const db = createDb(requireEnv('DATABASE_URL_MIGRATOR'), { max: 1 });
  try {
    await configureAiReader(db, requireEnv('ACME_AI_READER_PASSWORD'));
    console.log('acme_ai_reader can log in. Set DATABASE_URL_AI with this user and password.');
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
