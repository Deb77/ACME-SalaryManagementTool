import { createHash } from 'node:crypto';
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import type {
  CommitImportRequest,
  Import,
  ImportMappingRequest,
  ImportOutcome,
  ImportRow,
  ImportSummary,
  ImportUploadResponse,
} from '@acme/shared';
import type { Actor } from '../../auth/actor.js';
import type { ScopedDb, Tx } from '../../db/scope.js';
import {
  auditEvents,
  employees,
  importRows,
  imports,
  salaryChanges,
} from '../../db/schema/index.js';
import type { Clock } from '../../lib/clock.js';
import { csvLine } from '../../lib/csv.js';
import { AppError, conflict, invalid, notFound } from '../../lib/errors.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EmployeeRepository, EmployeeRow } from '../employees/employee.repository.js';
import type { CatalogueService } from '../meta/catalogue.service.js';
import type { SalaryService } from '../salary/salary.service.js';
import { parseSpreadsheet, suggestMapping } from './import.parser.js';
import { planRows, rowNumberOf, summarise, type PlannedRow } from './import.plan.js';

const BATCH = 1000;
type ImportRecord = typeof imports.$inferSelect;

function chunks<T>(items: readonly T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const toImport = (row: ImportRecord): Import => ({
  id: row.id,
  status: row.status,
  fileName: row.fileName,
  summary: (row.summary as ImportSummary | null) ?? null,
  createdAt: row.createdAt.toISOString(),
});

const label = (e: { employeeCode: string; firstName: string; lastName: string }) =>
  `${e.employeeCode} ${e.firstName} ${e.lastName}`;

/**
 * Spreadsheet import as a resource with a status: uploaded → validated → committed → undone
 * (docs/api.md, Import flow). Synchronous: each step is one request and one scoped
 * transaction, so RLS applies to every read and write exactly as for the UI.
 */
export class ImportService {
  constructor(
    private readonly scoped: ScopedDb,
    private readonly employees: EmployeeRepository,
    private readonly salary: SalaryService,
    private readonly audit: AuditService,
    private readonly catalogue: CatalogueService,
    private readonly clock: Clock,
  ) {}

  async upload(
    actor: Actor,
    file: { originalname: string; buffer: Buffer; size: number },
  ): Promise<ImportUploadResponse> {
    const sheet = await parseSpreadsheet(file.originalname, file.buffer);
    return this.scoped.run(actor, async (tx) => {
      const [created] = await tx
        .insert(imports)
        .values({
          createdBy: actor.userId,
          fileName: file.originalname.slice(0, 200),
          fileFormat: sheet.format,
          fileSizeBytes: file.size,
          fileSha256: createHash('sha256').update(file.buffer).digest(),
          columns: sheet.columns,
        })
        .returning();
      for (const batch of chunks(
        sheet.rows.map((raw, i) => ({ importId: created!.id, rowNumber: rowNumberOf(i), raw })),
      )) {
        await tx.insert(importRows).values(batch);
      }
      return {
        id: created!.id,
        status: 'uploaded' as const,
        fileName: created!.fileName,
        columns: sheet.columns,
        sampleRows: sheet.rows.slice(0, 5),
        suggestedMapping: suggestMapping(sheet.columns),
      };
    });
  }

  list(actor: Actor): Promise<Import[]> {
    return this.scoped.run(actor, async (tx) =>
      (await tx.select().from(imports).orderBy(desc(imports.createdAt)).limit(20)).map(toImport),
    );
  }

  get(actor: Actor, id: string): Promise<Import> {
    return this.scoped.run(actor, async (tx) => toImport(await this.load(tx, id)));
  }

  /** Sets the mapping and runs the dry run. Changes nothing but the import's own rows. */
  setMapping(actor: Actor, id: string, request: ImportMappingRequest): Promise<Import> {
    return this.scoped.run(actor, async (tx) => {
      const record = await this.load(tx, id, true);
      this.assertOwner(actor, record);
      if (record.status !== 'uploaded' && record.status !== 'validated') {
        throw conflict(`This import is already ${record.status}`);
      }
      const columns = record.columns as string[];
      for (const [field, header] of Object.entries(request.mapping)) {
        if (!columns.includes(header))
          throw invalid(`mapping.${field}`, `No column called "${header}"`);
      }
      const raw = await this.rawRows(tx, id);
      const plan = await this.plan(tx, actor, columns, raw, request);
      const summary = summarise(plan);

      await tx.delete(importRows).where(eq(importRows.importId, id));
      for (const batch of chunks(plan)) {
        await tx.insert(importRows).values(
          batch.map((row) => ({
            importId: id,
            rowNumber: row.rowNumber,
            raw: raw[row.rowNumber - 2] ?? [],
            outcome: row.outcome,
            employeeCode: row.employeeCode,
            employeeId: row.employeeId,
            countryCode: row.countryCode,
            changes: row.changes,
            errors: row.errors.length > 0 ? row.errors : null,
          })),
        );
      }
      const countryCodes = [
        ...new Set(
          plan.filter((r) => r.outcome !== 'error' && r.countryCode).map((r) => r.countryCode!),
        ),
      ].sort();
      const [updated] = await tx
        .update(imports)
        .set({
          status: 'validated',
          mapping: request.mapping,
          defaults: request.defaults ?? null,
          summary,
          countryCodes,
          validatedAt: sql`now()`,
        })
        .where(eq(imports.id, id))
        .returning();
      return toImport(updated!);
    });
  }

  rows(
    actor: Actor,
    id: string,
    outcome: ImportOutcome | undefined,
    page: number,
    pageSize: number,
  ) {
    return this.scoped.run(actor, async (tx) => {
      await this.load(tx, id);
      const where = and(
        eq(importRows.importId, id),
        outcome ? eq(importRows.outcome, outcome) : undefined,
      );
      const [rows, [total]] = await Promise.all([
        tx
          .select()
          .from(importRows)
          .where(where)
          .orderBy(asc(importRows.rowNumber))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        tx.select({ n: count() }).from(importRows).where(where),
      ]);
      const items: ImportRow[] = rows.map((r) => ({
        rowNumber: r.rowNumber,
        outcome: r.outcome ?? 'error',
        employeeCode: r.employeeCode,
        changes: (r.changes as ImportRow['changes'] | null) ?? {},
        errors:
          (r.errors as ImportRow['errors'] | null) ??
          (r.outcome ? [] : [{ column: '', message: 'Not validated yet' }]),
      }));
      return { items, page, pageSize, total: total?.n ?? 0 };
    });
  }

  /** Rows with their original cells plus the outcome and reasons, for fixing in Excel. */
  rowsCsv(
    actor: Actor,
    id: string,
    outcome: ImportOutcome | undefined,
  ): Promise<{ csv: string; fileName: string }> {
    return this.scoped.run(actor, async (tx) => {
      const record = await this.load(tx, id);
      const rows = await tx
        .select()
        .from(importRows)
        .where(
          and(eq(importRows.importId, id), outcome ? eq(importRows.outcome, outcome) : undefined),
        )
        .orderBy(asc(importRows.rowNumber));
      const columns = record.columns as string[];
      const lines = [csvLine(['Row', ...columns, 'Outcome', 'Problems'])];
      for (const r of rows) {
        const problems = ((r.errors as { column: string; message: string }[] | null) ?? [])
          .map((e) => (e.column ? `${e.column}: ${e.message}` : e.message))
          .join('; ');
        lines.push(csvLine([r.rowNumber, ...(r.raw as string[]), r.outcome ?? '', problems]));
      }
      const base = record.fileName.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-');
      return {
        csv: `\uFEFF${lines.join('\r\n')}\r\n`,
        fileName: `${base}-${outcome ?? 'rows'}.csv`,
      };
    });
  }

  /** Re-validates inside the transaction and applies every valid row, or nothing. */
  commit(actor: Actor, id: string, { skipInvalidRows }: CommitImportRequest): Promise<Import> {
    return this.scoped.run(actor, async (tx) => {
      const record = await this.load(tx, id, true);
      this.assertOwner(actor, record);
      if (record.status !== 'validated') {
        throw conflict(
          record.status === 'uploaded'
            ? 'Map the columns and review the dry run first'
            : `This import is already ${record.status}`,
        );
      }
      const stored = await tx
        .select({
          rowNumber: importRows.rowNumber,
          outcome: importRows.outcome,
          raw: importRows.raw,
        })
        .from(importRows)
        .where(eq(importRows.importId, id))
        .orderBy(asc(importRows.rowNumber));
      const request = {
        mapping: record.mapping as ImportMappingRequest['mapping'],
        defaults: (record.defaults ?? undefined) as ImportMappingRequest['defaults'],
      };
      const plan = await this.plan(
        tx,
        actor,
        record.columns as string[],
        stored.map((r) => r.raw as string[]),
        request,
      );
      const drifted = plan.filter((row, i) => row.outcome !== stored[i]?.outcome);
      if (drifted.length > 0) {
        throw conflict(
          'The data changed since the dry run. Run the check again before importing.',
          drifted
            .slice(0, 20)
            .map((r) => ({ path: `row ${r.rowNumber}`, message: `now ${r.outcome}` })),
        );
      }
      const summary = summarise(plan);
      if (summary.error > 0 && !skipInvalidRows) {
        throw invalid(
          'skipInvalidRows',
          `${summary.error} rows have errors; confirm that they should be skipped`,
        );
      }
      if (summary.create + summary.update === 0) throw conflict('There is nothing to import');

      await this.applyCreates(
        tx,
        actor,
        id,
        plan.filter((r) => r.outcome === 'create'),
      );
      for (const row of plan.filter((r) => r.outcome === 'update'))
        await this.applyUpdate(tx, actor, id, row);

      const [updated] = await tx
        .update(imports)
        .set({ status: 'committed', summary, committedAt: sql`now()` })
        .where(eq(imports.id, id))
        .returning();
      await this.audit.record(tx, actor, {
        action: 'import.committed',
        entityType: 'import',
        entityId: id,
        entityLabel: record.fileName,
        importId: id,
        after: summary,
        details: { countries: record.countryCodes },
      });
      return toImport(updated!);
    });
  }

  /** Reverts a committed import while it is still the latest change to everyone it touched. */
  undo(actor: Actor, id: string): Promise<Import> {
    return this.scoped.run(actor, async (tx) => {
      const record = await this.load(tx, id, true);
      this.assertOwner(actor, record);
      if (record.status !== 'committed' || !record.committedAt)
        throw conflict(`Only a committed import can be undone (this one is ${record.status})`);

      const touched = await tx
        .select({ row: importRows, employee: employees })
        .from(importRows)
        .innerJoin(employees, eq(employees.id, importRows.employeeId))
        .where(and(eq(importRows.importId, id), inArray(importRows.outcome, ['create', 'update'])))
        .for('update', { of: employees });
      const blocking = touched.filter(
        ({ employee }) => employee.updatedAt.getTime() > record.committedAt!.getTime(),
      );
      if (blocking.length > 0) {
        throw conflict(
          `${blocking.length} employees changed after this import, so it can no longer be undone`,
          blocking.slice(0, 20).map(({ employee }) => ({
            path: employee.employeeCode,
            message: 'Changed after the import',
          })),
        );
      }

      let restored = 0;
      for (const { row, employee } of touched.filter((t) => t.row.outcome === 'update')) {
        const changes = (row.changes ?? {}) as PlannedRow['changes'];
        const salary = changes.salaryAmountMinor;
        if (salary && typeof salary.from === 'number') {
          await this.salary.change(tx, actor, {
            employeeId: employee.id,
            amountMinor: salary.from,
            effectiveDate: String(changes.salaryEffectiveDate?.to ?? employee.salaryEffectiveDate),
            reason: 'import_undo',
            importId: id,
          });
        }
        const details = Object.fromEntries(
          Object.entries(changes)
            .filter(([field]) => field !== 'salaryAmountMinor' && field !== 'salaryEffectiveDate')
            .map(([field, change]) => [field, change.from]),
        );
        if (Object.keys(details).length > 0) {
          await this.employees.update(tx, employee.id, details);
          await this.audit.record(tx, actor, {
            action: 'employee.updated',
            entityType: 'employee',
            entityId: employee.id,
            entityLabel: label(employee),
            country: employee.countryCode,
            before: Object.fromEntries(
              Object.entries(changes)
                .filter(([f]) => f in details)
                .map(([f, c]) => [f, c.to]),
            ),
            after: details,
            importId: id,
            details: { undo: true },
          });
        }
        restored += 1;
      }

      const { rows } = await tx.execute<{ deleted: number }>(
        sql`select app_private.delete_import_created_employees(${id}::uuid) as deleted`,
      );
      const removed = Number(rows[0]?.deleted ?? 0);
      const [updated] = await tx
        .update(imports)
        .set({ status: 'undone', undoneAt: sql`now()` })
        .where(eq(imports.id, id))
        .returning();
      await this.audit.record(tx, actor, {
        action: 'import.undone',
        entityType: 'import',
        entityId: id,
        entityLabel: record.fileName,
        importId: id,
        after: { restored, removed },
      });
      return toImport(updated!);
    });
  }

  private async applyCreates(tx: Tx, actor: Actor, importId: string, rows: PlannedRow[]) {
    if (rows.length === 0) return;
    const catalogue = await this.catalogue.get();
    const needCodes = rows.filter((r) => !r.values.employeeCode).length;
    const generated =
      needCodes > 0
        ? (
            await tx.execute<{ code: string }>(
              sql`select app_private.next_employee_code() as code from generate_series(1, ${needCodes}::int)`,
            )
          ).rows.map((r) => r.code)
        : [];

    for (const batch of chunks(rows)) {
      const values = batch.map((row) => {
        const v = row.values;
        return {
          employeeCode: v.employeeCode ?? generated.shift()!,
          firstName: v.firstName!,
          lastName: v.lastName!,
          email: v.email!,
          countryCode: v.countryCode!,
          jobTitleId: v.jobTitleId!,
          departmentId: v.departmentId!,
          hireDate: v.hireDate!,
          salaryAmountMinor: v.salaryAmountMinor!,
          salaryCurrency: catalogue.currencyOf(v.countryCode!),
          salaryEffectiveDate: v.salaryEffectiveDate!,
          createdByImportId: importId,
        };
      });
      const created = await tx.insert(employees).values(values).returning();
      await tx.insert(salaryChanges).values(
        created.map((e) => ({
          employeeId: e.id,
          countryCode: e.countryCode,
          amountMinor: e.salaryAmountMinor,
          currency: e.salaryCurrency,
          effectiveDate: e.salaryEffectiveDate,
          reason: 'import' as const,
          importId,
          createdBy: actor.userId,
        })),
      );
      await tx.insert(auditEvents).values(
        created.map((e) => ({
          actorId: actor.userId,
          actorRole: actor.role.key,
          action: 'employee.created' as const,
          entityType: 'employee' as const,
          entityId: e.id,
          entityLabel: label(e),
          countryCode: e.countryCode,
          after: {
            employeeCode: e.employeeCode,
            country: e.countryCode,
            jobTitleId: e.jobTitleId,
            salaryAmountMinor: e.salaryAmountMinor,
          },
          importId,
        })),
      );
      // Remember which employee each row became, for the review screen and for undo.
      const pairs = batch.map(
        (row, i) =>
          sql`(${row.rowNumber}::int, ${created[i]!.id}::uuid, ${created[i]!.employeeCode})`,
      );
      await tx.execute(sql`
        update import_rows r set employee_id = v.id, employee_code = v.code
          from (values ${sql.join(pairs, sql`, `)}) as v(row_number, id, code)
         where r.import_id = ${importId} and r.row_number = v.row_number`);
    }
  }

  private async applyUpdate(tx: Tx, actor: Actor, importId: string, row: PlannedRow) {
    const { salaryAmountMinor, salaryEffectiveDate, ...details } = row.values;
    if (salaryAmountMinor !== undefined) {
      await this.salary.change(tx, actor, {
        employeeId: row.employeeId!,
        amountMinor: salaryAmountMinor,
        effectiveDate: salaryEffectiveDate!,
        reason: 'import',
        importId,
      });
    }
    if (Object.keys(details).length > 0) {
      const current = await this.employees.get(tx, row.employeeId!);
      if (!current) throw notFound('Employee not found');
      await this.employees.update(tx, row.employeeId!, details);
      const changed = Object.keys(details);
      await this.audit.record(tx, actor, {
        action: 'employee.updated',
        entityType: 'employee',
        entityId: row.employeeId!,
        entityLabel: label(current.employee),
        country: current.employee.countryCode,
        before: Object.fromEntries(changed.map((f) => [f, row.changes[f]?.from ?? null])),
        after: Object.fromEntries(changed.map((f) => [f, row.changes[f]?.to ?? null])),
        importId,
      });
    }
  }

  private async plan(
    tx: Tx,
    actor: Actor,
    columns: string[],
    raw: string[][],
    request: ImportMappingRequest,
  ) {
    const catalogue = await this.catalogue.get();
    const at = (field: string) => {
      const header = request.mapping[field as keyof typeof request.mapping];
      return header === undefined ? -1 : columns.indexOf(header);
    };
    const codeAt = at('employeeCode');
    const emailAt = at('email');
    const codes =
      codeAt < 0
        ? []
        : [...new Set(raw.map((r) => (r[codeAt] ?? '').trim().toUpperCase()).filter(Boolean))];
    const emails =
      emailAt < 0
        ? []
        : [...new Set(raw.map((r) => (r[emailAt] ?? '').trim().toLowerCase()).filter(Boolean))];
    const existing: EmployeeRow[] = [];
    for (const batch of chunks(codes, 5000))
      existing.push(...(await this.employees.findByCodes(tx, batch)));
    for (const batch of chunks(emails, 5000))
      existing.push(...(await this.employees.findByEmails(tx, batch)));
    return planRows(columns, raw, request, {
      catalogue,
      countries: actor.countries,
      byCode: new Map(existing.map((e) => [e.employeeCode, e])),
      byEmail: new Map(existing.map((e) => [e.email, e])),
      today: this.clock.today(),
    });
  }

  private async rawRows(tx: Tx, id: string): Promise<string[][]> {
    const rows = await tx
      .select({ raw: importRows.raw })
      .from(importRows)
      .where(and(eq(importRows.importId, id), gt(importRows.rowNumber, 0)))
      .orderBy(asc(importRows.rowNumber));
    return rows.map((r) => r.raw as string[]);
  }

  private async load(tx: Tx, id: string, lock = false): Promise<ImportRecord> {
    const query = tx.select().from(imports).where(eq(imports.id, id));
    const [record] = lock ? await query.for('update') : await query;
    if (!record) throw notFound('Import not found');
    return record;
  }

  private assertOwner(actor: Actor, record: ImportRecord) {
    if (record.createdBy !== actor.userId) {
      throw new AppError('forbidden', 'Only the person who uploaded this file can change it');
    }
  }
}
