import { parse } from 'libpg-query';

/**
 * The code-side check on model-written SQL (docs/auth.md, Ask AI; decision #36). The database is
 * the real boundary (a read-only login role with column grants and RLS), but nothing reaches it
 * unless the real Postgres parser says it is exactly one SELECT over the allowed tables that
 * calls only allow-listed functions.
 */

/** Tables acme_ai_reader can read; employees and salary_changes only through column grants. */
export const AI_TABLES = new Set([
  'employees',
  'salary_changes',
  'countries',
  'job_titles',
  'departments',
  'fx_rates',
]);

/** Aggregates, maths, dates, strings and window functions. Nothing that reads settings or files. */
export const AI_FUNCTIONS = new Set(
  [
    // aggregates
    'count sum avg min max stddev stddev_pop stddev_samp variance var_pop var_samp percentile_cont percentile_disc mode bool_and bool_or every array_agg string_agg json_agg jsonb_agg corr regr_slope',
    // window
    'row_number rank dense_rank percent_rank cume_dist ntile lag lead first_value last_value nth_value',
    // maths
    'round floor ceil ceiling abs trunc sign power sqrt mod div width_bucket numeric int8 int4 float8',
    // dates
    'date_trunc date_part extract age make_date make_interval to_char to_date now timezone date_bin generate_series justify_days overlaps',
    // strings and arrays
    'lower upper length char_length substring substr concat concat_ws btrim ltrim rtrim trim left right replace split_part position starts_with format lpad rpad cardinality array_length unnest array_position json_build_object jsonb_build_object',
  ]
    .join(' ')
    .split(' '),
);

/** Casting to these types runs catalogue lookups; no answer needs them. */
const FORBIDDEN_TYPES = /^reg[a-z]*$/;

export type SqlCheck =
  { ok: true; statement: string } | { ok: false; code: SqlRejection; message: string };

export type SqlRejection =
  | 'too_long'
  | 'parse_error'
  | 'not_single_statement'
  | 'not_select'
  | 'forbidden_clause'
  | 'forbidden_table'
  | 'forbidden_function'
  | 'forbidden_type';

const MAX_SQL_LENGTH = 5000;

type Node = Record<string, unknown>;

const reject = (code: SqlRejection, message: string): SqlCheck => ({ ok: false, code, message });

function names(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const string = (item as { String?: { sval?: string } }).String;
    return string?.sval ?? '';
  });
}

/** Every CTE name in the tree, so `with x as (...) select from x` is not read as a table. */
function cteNames(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((child) => cteNames(child, found));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Node)) {
      if (key === 'CommonTableExpr') {
        const name = (value as { ctename?: string }).ctename;
        if (name) found.add(name.toLowerCase());
      }
      cteNames(value, found);
    }
  }
  return found;
}

function walk(node: unknown, ctes: Set<string>): SqlCheck | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const failure = walk(child, ctes);
      if (failure) return failure;
    }
    return undefined;
  }
  if (!node || typeof node !== 'object') return undefined;
  for (const [key, value] of Object.entries(node as Node)) {
    // Any statement other than SELECT, e.g. a data-modifying CTE (`with d as (delete …)`).
    if (key.endsWith('Stmt') && key !== 'SelectStmt') {
      return reject('not_select', 'Only SELECT queries are allowed');
    }
    if (key === 'SelectStmt') {
      const select = value as Node;
      if (select.intoClause) return reject('forbidden_clause', 'SELECT INTO is not allowed');
      if (Array.isArray(select.lockingClause) && select.lockingClause.length > 0) {
        return reject('forbidden_clause', 'Row locks (FOR UPDATE/SHARE) are not allowed');
      }
    }
    if (key === 'RangeVar') {
      const range = value as { relname?: string; schemaname?: string; catalogname?: string };
      const table = (range.relname ?? '').toLowerCase();
      if (range.catalogname || (range.schemaname && range.schemaname !== 'public')) {
        return reject('forbidden_table', `Table ${range.schemaname}.${table} is not available`);
      }
      if (!AI_TABLES.has(table) && !(ctes.has(table) && !range.schemaname)) {
        return reject(
          'forbidden_table',
          `Table "${table}" is not available. Use: ${[...AI_TABLES].join(', ')}`,
        );
      }
    }
    if (key === 'FuncCall') {
      const parts = names((value as { funcname?: unknown }).funcname).map((n) => n.toLowerCase());
      const name = parts.at(-1) ?? '';
      const schema = parts.length > 1 ? parts[0] : undefined;
      if (parts.length > 2 || (schema && schema !== 'pg_catalog') || !AI_FUNCTIONS.has(name)) {
        return reject('forbidden_function', `Function "${parts.join('.')}" is not allowed`);
      }
    }
    if (key === 'typeName' || key === 'TypeName') {
      const type =
        names((value as { names?: unknown }).names)
          .at(-1)
          ?.toLowerCase() ?? '';
      if (FORBIDDEN_TYPES.test(type)) {
        return reject('forbidden_type', `Casting to ${type} is not allowed`);
      }
    }
    const failure = walk(value, ctes);
    if (failure) return failure;
  }
  return undefined;
}

/** The statement's own text, without a trailing semicolon, comments or whitespace. */
function statementText(sql: string, stmt: { stmt_location?: number; stmt_len?: number }): string {
  const start = stmt.stmt_location ?? 0;
  const text = stmt.stmt_len ? sql.slice(start, start + stmt.stmt_len) : sql.slice(start);
  return text.trim().replace(/;\s*$/, '');
}

/** Checks model-written SQL. On success returns the single statement to run. */
export async function checkSql(sql: string): Promise<SqlCheck> {
  if (sql.length > MAX_SQL_LENGTH) {
    return reject('too_long', `The query is longer than ${MAX_SQL_LENGTH} characters`);
  }
  let tree: { stmts?: { stmt?: Node; stmt_location?: number; stmt_len?: number }[] };
  try {
    tree = (await parse(sql)) as typeof tree;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'syntax error';
    return reject('parse_error', `The query does not parse: ${message.slice(0, 200)}`);
  }
  const stmts = tree.stmts ?? [];
  if (stmts.length !== 1) {
    return reject('not_single_statement', 'Send exactly one statement');
  }
  const [first] = stmts;
  if (!first?.stmt || !('SelectStmt' in first.stmt)) {
    return reject('not_select', 'Only SELECT queries are allowed');
  }
  const failure = walk(first.stmt, cteNames(first.stmt));
  if (failure) return failure;
  return { ok: true, statement: statementText(sql, first) };
}

/**
 * Wraps a checked statement so Postgres stops after `cap + 1` rows (the extra row tells us the
 * result was cut). The newline before `)` keeps a trailing `--` comment from swallowing it, and
 * the wrapped text is parsed again so the wrapper itself cannot change what runs.
 */
export async function withRowCap(statement: string, cap: number): Promise<string> {
  const wrapped = `select * from (\n${statement}\n) as ai_result limit ${cap + 1}`;
  const check = await checkSql(wrapped);
  if (!check.ok) throw new Error(`row cap wrapper rejected: ${check.code}`);
  return wrapped;
}
