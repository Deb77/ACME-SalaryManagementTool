import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Employee, ExportEmployeesQuery } from '@acme/shared';
import type { Tx } from '../../db/scope.js';
import { departments, employees, jobTitles } from '../../db/schema/index.js';

export type EmployeeRow = typeof employees.$inferSelect;
export type NewEmployeeRow = typeof employees.$inferInsert;

const columns = {
  employee: employees,
  jobTitleName: jobTitles.name,
  departmentName: departments.name,
};

export type EmployeeWithNames = {
  employee: EmployeeRow;
  jobTitleName: string;
  departmentName: string;
};

export function toEmployee({
  employee: e,
  jobTitleName,
  departmentName,
}: EmployeeWithNames): Employee {
  return {
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    country: e.countryCode,
    jobTitle: { id: e.jobTitleId, name: jobTitleName },
    department: { id: e.departmentId, name: departmentName },
    hireDate: e.hireDate,
    status: e.status,
    termination:
      e.status === 'terminated' && e.terminationDate && e.terminationReason
        ? { date: e.terminationDate, reason: e.terminationReason, note: e.terminationNote }
        : null,
    salary: { amountMinor: e.salaryAmountMinor, currency: e.salaryCurrency },
    salaryEffectiveDate: e.salaryEffectiveDate,
    version: e.version,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
const likeEscape = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function filters(query: ExportEmployeesQuery): SQL | undefined {
  const conditions: SQL[] = [];
  if (query.status !== 'all') conditions.push(eq(employees.status, query.status));
  if (query.country) conditions.push(inArray(employees.countryCode, query.country));
  if (query.department) conditions.push(inArray(employees.departmentId, query.department));
  if (query.jobTitle) conditions.push(inArray(employees.jobTitleId, query.jobTitle));
  if (query.q) {
    const pattern = `%${likeEscape(query.q)}%`;
    conditions.push(
      or(
        // Matches "Asha Rao" as typed, and each part on its own. ILIKE is not leakproof, so under
        // RLS no trigram index could serve it; it filters the rows in scope (a few ms at 10k).
        ilike(sql`(${employees.firstName} || ' ' || ${employees.lastName})`, pattern),
        ilike(employees.email, pattern),
        ilike(employees.employeeCode, pattern),
      )!,
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function ordering(query: ExportEmployeesQuery): SQL[] {
  const dir = query.sort.direction === 'desc' ? desc : asc;
  const by: Record<ExportEmployeesQuery['sort']['field'], SQL[]> = {
    name: [dir(employees.lastName), dir(employees.firstName)],
    employeeCode: [dir(employees.employeeCode)],
    country: [dir(employees.countryCode), asc(employees.lastName)],
    jobTitle: [dir(jobTitles.name), asc(employees.lastName)],
    department: [dir(departments.name), asc(employees.lastName)],
    hireDate: [dir(employees.hireDate)],
    salary: [dir(employees.salaryAmountMinor)],
  };
  // `id` breaks ties, so pages are stable.
  return [...by[query.sort.field], asc(employees.id)];
}

/** Plain Drizzle over a scoped transaction; RLS has already limited the rows to the actor's countries. */
export class EmployeeRepository {
  async list(
    tx: Tx,
    query: ExportEmployeesQuery,
    page?: { limit: number; offset: number },
  ): Promise<{ rows: EmployeeWithNames[]; total: number }> {
    const where = filters(query);
    const base = tx
      .select(columns)
      .from(employees)
      .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
      .innerJoin(departments, eq(departments.id, employees.departmentId))
      .where(where)
      .orderBy(...ordering(query));
    if (!page) {
      const rows = await base;
      return { rows, total: rows.length };
    }
    // A separate count, not `count(*) over ()`: the window would make Postgres read and sort
    // every row in scope, while a plain LIMIT can stop early on the sort's index.
    const [rows, [count]] = await Promise.all([
      base.limit(page.limit).offset(page.offset),
      tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(employees)
        .where(where),
    ]);
    const total = count?.n ?? 0;
    return { rows, total };
  }

  async get(tx: Tx, id: string, { lock = false } = {}): Promise<EmployeeWithNames | undefined> {
    const query = tx
      .select(columns)
      .from(employees)
      .innerJoin(jobTitles, eq(jobTitles.id, employees.jobTitleId))
      .innerJoin(departments, eq(departments.id, employees.departmentId))
      .where(eq(employees.id, id));
    const [row] = lock ? await query.for('update', { of: employees }) : await query;
    return row;
  }

  async findByCodes(tx: Tx, codes: string[]): Promise<EmployeeRow[]> {
    if (codes.length === 0) return [];
    return tx.select().from(employees).where(inArray(employees.employeeCode, codes));
  }

  async findByEmails(tx: Tx, emails: string[]): Promise<EmployeeRow[]> {
    if (emails.length === 0) return [];
    return tx.select().from(employees).where(inArray(employees.email, emails));
  }

  async nextCode(tx: Tx): Promise<string> {
    const { rows } = await tx.execute<{ code: string }>(
      sql`select app_private.next_employee_code() as code`,
    );
    return rows[0]!.code;
  }

  async nextCodes(tx: Tx, n: number): Promise<string[]> {
    if (n <= 0) return [];
    const { rows } = await tx.execute<{ code: string }>(
      sql`select app_private.next_employee_code() as code from generate_series(1, ${n}::int)`,
    );
    return rows.map((r) => r.code);
  }

  async insertMany(tx: Tx, values: NewEmployeeRow[]): Promise<EmployeeRow[]> {
    return tx.insert(employees).values(values).returning();
  }

  async insert(tx: Tx, values: NewEmployeeRow): Promise<EmployeeRow> {
    const [row] = await tx.insert(employees).values(values).returning();
    return row!;
  }

  /** Updates and bumps `version`; returns undefined when RLS hides the row. */
  async update(
    tx: Tx,
    id: string,
    patch: Partial<NewEmployeeRow>,
  ): Promise<EmployeeRow | undefined> {
    const [row] = await tx
      .update(employees)
      .set({ ...patch, version: sql`${employees.version} + 1`, updatedAt: sql`now()` })
      .where(eq(employees.id, id))
      .returning();
    return row;
  }
}
