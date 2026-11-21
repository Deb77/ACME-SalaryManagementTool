import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Db = NodePgDatabase<typeof schema> & { $client: pg.Pool };

export type DatabaseSsl = 'off' | 'verify' | 'no-verify';

function isLocalHost(connectionString: string): boolean {
  const { hostname } = new URL(connectionString);
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}

/**
 * TLS for the connection. Local databases default to plain connections, anything else to TLS
 * with certificate checks. `DATABASE_SSL=no-verify` is the escape hatch for a host whose
 * certificate chain Node does not trust.
 */
export function sslOption(
  connectionString: string,
  setting = process.env.DATABASE_SSL,
): pg.PoolConfig['ssl'] {
  const mode =
    (setting as DatabaseSsl | undefined) ?? (isLocalHost(connectionString) ? 'off' : 'verify');
  if (mode === 'off') return false;
  return { rejectUnauthorized: mode === 'verify' };
}

export interface CreateDbOptions {
  max?: number;
  /**
   * Database role the session runs as, set at connection start (`-c role=...`). The API uses
   * `acme_app`, which does not own the tables, so row-level security always applies to it
   * (docs/auth.md, Database roles). The login user must be a member of the role.
   */
  role?: string;
}

/** A Drizzle client on its own pool. Close it with `db.$client.end()`. */
export function createDb(connectionString: string, options: CreateDbOptions = {}): Db {
  // TLS comes from `sslOption`, so drop any sslmode in the URL (pg would let it override ours).
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  if (options.role && !/^[a-z_][a-z0-9_]*$/.test(options.role)) {
    throw new Error(`Invalid role name "${options.role}"`);
  }
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: sslOption(connectionString),
    max: options.max ?? 5,
    // Fail fast instead of queueing forever when the database is unreachable.
    connectionTimeoutMillis: 10_000,
    options: options.role ? `-c role=${options.role}` : undefined,
  });
  return drizzle(pool, { schema, casing: 'snake_case' });
}

/** Reads a required connection string from the environment, naming the variable on failure. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env at the repo root and fill it in (see README, "Database").`,
    );
  }
  return value;
}

/** A script failure as one line, with the driver's reason (Drizzle hides it in `cause`). */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause : undefined;
  const reason = cause ? `${(cause as { code?: string }).code ?? ''} ${cause.message}`.trim() : '';
  return reason ? `${error.message.split('\n')[0]}: ${reason}` : error.message;
}
