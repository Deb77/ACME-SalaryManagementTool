import { and, asc, count, desc, eq, gt, inArray, sql, type SQL } from 'drizzle-orm';
import type { ImportOutcome } from '@acme/shared';
import type { Tx } from '../../db/scope.js';
import { employees, importRows, imports } from '../../db/schema/index.js';

export type ImportRecord = typeof imports.$inferSelect;
export type NewImportRecord = typeof imports.$inferInsert;
export type NewImportRow = typeof importRows.$inferInsert;

/** Imports and their rows. Every read and write runs in the caller's scoped transaction. */
export class ImportRepository {
  async create(tx: Tx, values: NewImportRecord): Promise<ImportRecord> {
    const [row] = await tx.insert(imports).values(values).returning();
    return row!;
  }

  async latest(tx: Tx, limit = 20): Promise<ImportRecord[]> {
    return tx.select().from(imports).orderBy(desc(imports.createdAt)).limit(limit);
  }

  async get(tx: Tx, id: string, { lock = false } = {}): Promise<ImportRecord | undefined> {
    const query = tx.select().from(imports).where(eq(imports.id, id));
    const [record] = lock ? await query.for('update') : await query;
    return record;
  }

  /** Sets fields on the import; `stamp` names the timestamp column to set to now(). */
  async update(
    tx: Tx,
    id: string,
    patch: Partial<NewImportRecord>,
    stamp: 'validatedAt' | 'committedAt' | 'undoneAt',
  ): Promise<ImportRecord> {
    const [row] = await tx
      .update(imports)
      .set({ ...patch, [stamp]: sql`now()` })
      .where(eq(imports.id, id))
      .returning();
    return row!;
  }

  async insertRows(tx: Tx, rows: NewImportRow[]): Promise<void> {
    if (rows.length > 0) await tx.insert(importRows).values(rows);
  }

  async deleteRows(tx: Tx, importId: string): Promise<void> {
    await tx.delete(importRows).where(eq(importRows.importId, importId));
  }

  /** The file's cells, in row order. */
  async rawRows(tx: Tx, importId: string): Promise<string[][]> {
    const rows = await tx
      .select({ raw: importRows.raw })
      .from(importRows)
      .where(and(eq(importRows.importId, importId), gt(importRows.rowNumber, 0)))
      .orderBy(asc(importRows.rowNumber));
    return rows.map((r) => r.raw as string[]);
  }

  /** Each row's dry-run outcome and cells, in row order, for re-checking at commit. */
  async storedRows(tx: Tx, importId: string) {
    return tx
      .select({ rowNumber: importRows.rowNumber, outcome: importRows.outcome, raw: importRows.raw })
      .from(importRows)
      .where(eq(importRows.importId, importId))
      .orderBy(asc(importRows.rowNumber));
  }

  /** One page of rows with the matched employee's name, and the total. */
  async page(
    tx: Tx,
    importId: string,
    outcome: ImportOutcome | undefined,
    page: number,
    pageSize: number,
  ) {
    const where: SQL | undefined = and(
      eq(importRows.importId, importId),
      outcome ? eq(importRows.outcome, outcome) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      tx
        .select({ row: importRows, firstName: employees.firstName, lastName: employees.lastName })
        .from(importRows)
        .leftJoin(employees, eq(employees.id, importRows.employeeId))
        .where(where)
        .orderBy(asc(importRows.rowNumber))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx.select({ n: count() }).from(importRows).where(where),
    ]);
    return { rows, total: total?.n ?? 0 };
  }

  /** The employees an import created or updated, locked for undo. */
  async lockTouched(tx: Tx, importId: string) {
    return tx
      .select({ row: importRows, employee: employees })
      .from(importRows)
      .innerJoin(employees, eq(employees.id, importRows.employeeId))
      .where(
        and(eq(importRows.importId, importId), inArray(importRows.outcome, ['create', 'update'])),
      )
      .for('update', { of: employees });
  }

  /** Records which employee each created row became, for the review screen and for undo. */
  async linkCreated(
    tx: Tx,
    importId: string,
    links: { rowNumber: number; employeeId: string; employeeCode: string }[],
  ): Promise<void> {
    if (links.length === 0) return;
    const pairs = links.map(
      (l) => sql`(${l.rowNumber}::int, ${l.employeeId}::uuid, ${l.employeeCode})`,
    );
    await tx.execute(sql`
      update import_rows r set employee_id = v.id, employee_code = v.code
        from (values ${sql.join(pairs, sql`, `)}) as v(row_number, id, code)
       where r.import_id = ${importId} and r.row_number = v.row_number`);
  }

  /** Deletes the employees an import created (and their history); returns how many. */
  async deleteCreatedEmployees(tx: Tx, importId: string): Promise<number> {
    const { rows } = await tx.execute<{ deleted: number }>(
      sql`select app_private.delete_import_created_employees(${importId}::uuid) as deleted`,
    );
    return Number(rows[0]?.deleted ?? 0);
  }
}
