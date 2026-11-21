import { sql } from 'drizzle-orm';
import pg from 'pg';
import { sslOption, type Db } from '../../db/database.js';
import { checkSql, withRowCap } from './sql-guard.js';

export type SqlRunStatus = 'ok' | 'rejected' | 'error' | 'timeout';

export interface SqlRunResult {
  status: SqlRunStatus;
  /** Column names and rows as arrays; only on `ok`. */
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  /** More rows (or more bytes) existed than the model is given. */
  truncated: boolean;
  errorCode: string | null;
  /** Short reason the model and the audit log see. Never contains result rows. */
  errorMessage: string | null;
  durationMs: number;
}

export interface SqlRunnerOptions {
  rowCap: number;
  maxResultChars: number;
  /** How long the ai_scope row stays valid; one query is limited to 5 s by the role anyway. */
  scopeTtlSeconds?: number;
  /** Per query, at most the role's own 5 s (tests use less). */
  statementTimeoutMs?: number;
  now?: () => number;
}

/** The AI pool (DATABASE_URL_AI, user acme_ai_reader): two connections, never shared with the API. */
export function createAiPool(connectionString: string): pg.Pool {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return new pg.Pool({
    connectionString: url.toString(),
    ssl: sslOption(connectionString),
    max: 2,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
}

interface PgError {
  code?: string;
  message?: string;
}

function failure(
  status: SqlRunStatus,
  errorCode: string,
  errorMessage: string,
  durationMs: number,
): SqlRunResult {
  return {
    status,
    columns: [],
    rows: [],
    rowCount: 0,
    truncated: false,
    errorCode,
    errorMessage: errorMessage.slice(0, 300),
    durationMs,
  };
}

/** JSON-safe cell values (int8 and numeric arrive as strings, dates as Date). */
/**
 * `date` and `timestamp` (without time zone) come back as Postgres wrote them. The driver's
 * default turns them into a JS Date at local midnight, and toISOString() then moved every date
 * a day back on servers east of UTC (2026-08-28 became 2026-08-27T18:30Z in India).
 */
const AS_WRITTEN = new Set([1082, 1114]); // date, timestamp
const resultTypes = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
    AS_WRITTEN.has(oid)
      ? (value: string) => value
      : pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
};

function cell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/**
 * Runs one model-written query as `acme_ai_reader` (docs/auth.md, Ask AI):
 *
 * 1. check the SQL (one SELECT, allowed tables and functions) — rejected SQL never connects;
 * 2. check out an AI connection and read its backend PID;
 * 3. as acme_app, upsert `app_private.ai_scope(pid, countries)` from the session;
 * 4. on the AI connection: `begin read only`, the statement over the extended protocol (so no
 *    stacked statements), `rollback`;
 * 5. delete the scope row and release the connection.
 */
export class SqlRunner {
  constructor(
    private readonly appDb: Db,
    private readonly pool: pg.Pool | null,
    private readonly options: SqlRunnerOptions,
  ) {}

  get available(): boolean {
    return this.pool !== null;
  }

  /** `ok` when a connection as acme_ai_reader opens; for the health endpoint. */
  async ping(): Promise<'ok' | 'unreachable' | 'not_configured'> {
    if (!this.pool) return 'not_configured';
    try {
      await this.pool.query('select 1');
      return 'ok';
    } catch {
      return 'unreachable';
    }
  }

  async run(countries: readonly string[], text: string): Promise<SqlRunResult> {
    const now = this.options.now ?? (() => performance.now());
    const started = now();
    const elapsed = () => Math.round(now() - started);

    const check = await checkSql(text);
    if (!check.ok) return failure('rejected', check.code, check.message, elapsed());
    if (!this.pool) return failure('error', 'not_configured', 'Ask AI has no database', elapsed());

    const statement = await withRowCap(check.statement, this.options.rowCap);
    const client = await this.pool.connect();
    let pid: number | undefined;
    let broken = false;
    try {
      const pidResult = await client.query<{ pid: number }>('select pg_backend_pid() as pid');
      pid = pidResult.rows[0]!.pid;
      const ttl = this.options.scopeTtlSeconds ?? 30;
      await this.appDb.execute(sql`
        insert into app_private.ai_scope (backend_pid, countries, expires_at)
        values (${pid}, ${`{${countries.join(',')}}`}::char(2)[], now() + make_interval(secs => ${ttl}))
        on conflict (backend_pid) do update
          set countries = excluded.countries, expires_at = excluded.expires_at`);

      await client.query('begin read only');
      try {
        // The role default too; set again so a changed default can never lift it.
        const timeoutMs = Math.min(
          Math.max(Math.trunc(this.options.statementTimeoutMs ?? 5000), 1),
          5000,
        );
        await client.query(`set local statement_timeout = ${timeoutMs}`);
        const result = await client.query({
          text: statement,
          values: [],
          rowMode: 'array',
          types: resultTypes,
          // Extended protocol: Postgres refuses more than one statement in a Parse message.
          queryMode: 'extended',
        } as pg.QueryArrayConfig);
        return this.shape(result, elapsed());
      } finally {
        await client.query('rollback').catch(() => {
          broken = true;
        });
      }
    } catch (error) {
      const pgError = error as PgError;
      if (pgError.code === '57014') {
        return failure('timeout', 'statement_timeout', 'The query took longer than 5 s', elapsed());
      }
      const code = pgError.code === '42501' ? 'permission_denied' : `pg_${pgError.code ?? 'error'}`;
      if (!pgError.code) broken = true;
      return failure('error', code, pgError.message ?? 'The query failed', elapsed());
    } finally {
      if (pid !== undefined) {
        await this.appDb
          .execute(sql`delete from app_private.ai_scope where backend_pid = ${pid}`)
          .catch(() => {});
      }
      client.release(broken);
    }
  }

  private shape(result: pg.QueryArrayResult, durationMs: number): SqlRunResult {
    const columns = result.fields.map((field) => field.name);
    let rows = result.rows.map((row) => row.map(cell));
    let truncated = rows.length > this.options.rowCap;
    if (truncated) rows = rows.slice(0, this.options.rowCap);
    // Keep the payload the model reads small: drop rows from the end until it fits.
    while (rows.length > 0 && JSON.stringify(rows).length > this.options.maxResultChars) {
      rows = rows.slice(0, Math.max(0, Math.floor(rows.length * 0.8)));
      truncated = true;
    }
    return {
      status: 'ok',
      columns,
      rows,
      rowCount: rows.length,
      truncated,
      errorCode: null,
      errorMessage: null,
      durationMs,
    };
  }
}
