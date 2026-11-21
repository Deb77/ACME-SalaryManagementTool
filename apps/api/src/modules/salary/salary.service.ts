import { desc, eq } from 'drizzle-orm';
import type { SalaryChange } from '@acme/shared';
import type { Actor } from '../../auth/actor.js';
import type { Tx } from '../../db/scope.js';
import { salaryChanges, users } from '../../db/schema/index.js';
import type { Clock } from '../../lib/clock.js';
import { conflict, invalid, notFound, staleVersion } from '../../lib/errors.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EmployeeRepository, EmployeeRow } from '../employees/employee.repository.js';

type Reason = (typeof salaryChanges.reason.enumValues)[number];
type SalaryChangeRow = typeof salaryChanges.$inferSelect;

export interface SalaryChangeInput {
  employeeId: string;
  amountMinor: number;
  effectiveDate: string;
  reason: Reason;
  note?: string | null;
  /** The version the user saw; omitted by import, which locks and re-reads instead. */
  version?: number;
  importId?: string | null;
  aiDraftId?: string | null;
}

function toSalaryChange(
  row: SalaryChangeRow,
  createdBy: { id: string; name: string },
  aiDraftId: string | null = null,
): SalaryChange {
  return {
    id: row.id,
    employeeId: row.employeeId,
    amount: { amountMinor: row.amountMinor, currency: row.currency },
    previousAmount:
      row.previousAmountMinor === null
        ? null
        : { amountMinor: row.previousAmountMinor, currency: row.currency },
    effectiveDate: row.effectiveDate,
    reason: row.reason,
    note: row.note,
    importId: row.importId,
    aiDraftId,
    createdAt: row.createdAt.toISOString(),
    createdBy,
  };
}

/**
 * The only code path that writes pay (docs/api.md, Salary changes). The dialog, import and
 * import undo all come through `change()`, which locks the employee, checks the version,
 * appends history, updates the current salary and writes the audit row in the caller's
 * transaction.
 */
export class SalaryService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async history(tx: Tx, employeeId: string): Promise<SalaryChange[]> {
    const employee = await this.employees.get(tx, employeeId);
    if (!employee) throw notFound('Employee not found');
    const rows = await tx
      .select({ change: salaryChanges, byId: users.id, byName: users.name })
      .from(salaryChanges)
      .innerJoin(users, eq(users.id, salaryChanges.createdBy))
      .where(eq(salaryChanges.employeeId, employeeId))
      .orderBy(desc(salaryChanges.effectiveDate), desc(salaryChanges.createdAt));
    return rows.map((r) => toSalaryChange(r.change, { id: r.byId, name: r.byName }));
  }

  async change(
    tx: Tx,
    actor: Actor,
    input: SalaryChangeInput,
  ): Promise<{ salaryChange: SalaryChange; employee: EmployeeRow }> {
    const current = await this.employees.get(tx, input.employeeId, { lock: true });
    if (!current) throw notFound('Employee not found');
    const before = current.employee;
    if (input.version !== undefined && input.version !== before.version) throw staleVersion();
    if (before.status !== 'active')
      throw conflict('This employee has left; their pay cannot change');
    if (input.effectiveDate < before.salaryEffectiveDate) {
      throw invalid(
        'effectiveDate',
        `Must be on or after the latest salary entry (${before.salaryEffectiveDate}). Fix a past amount with a correction.`,
      );
    }
    if (
      input.reason !== 'import' &&
      input.reason !== 'import_undo' &&
      input.effectiveDate > this.clock.today()
    ) {
      throw invalid('effectiveDate', 'Future-dated changes are not supported yet');
    }
    if (
      input.amountMinor === before.salaryAmountMinor &&
      input.reason !== 'correction' &&
      !input.importId
    ) {
      throw invalid('amountMinor', 'The new salary is the same as the current one');
    }

    const [row] = await tx
      .insert(salaryChanges)
      .values({
        employeeId: before.id,
        countryCode: before.countryCode,
        amountMinor: input.amountMinor,
        previousAmountMinor: before.salaryAmountMinor,
        currency: before.salaryCurrency,
        effectiveDate: input.effectiveDate,
        reason: input.reason,
        note: input.note ?? null,
        importId: input.importId ?? null,
        createdBy: actor.userId,
      })
      .returning();

    const employee = await this.employees.update(tx, before.id, {
      salaryAmountMinor: input.amountMinor,
      salaryEffectiveDate: input.effectiveDate,
    });
    if (!employee) throw notFound('Employee not found');

    await this.audit.record(tx, actor, {
      action: 'salary.changed',
      entityType: 'employee',
      entityId: before.id,
      entityLabel: `${before.employeeCode} ${before.firstName} ${before.lastName}`,
      country: before.countryCode,
      before: {
        salaryAmountMinor: before.salaryAmountMinor,
        salaryEffectiveDate: before.salaryEffectiveDate,
      },
      after: { salaryAmountMinor: input.amountMinor, salaryEffectiveDate: input.effectiveDate },
      importId: input.importId ?? null,
      details: {
        currency: before.salaryCurrency,
        reason: input.reason,
        note: input.note ?? null,
        aiDraftId: input.aiDraftId ?? null,
      },
    });

    return {
      salaryChange: toSalaryChange(
        row!,
        { id: actor.userId, name: actor.name },
        input.aiDraftId ?? null,
      ),
      employee,
    };
  }

  /** The first entry for a new employee (`hire` or `import`), written with the employee row. */
  async recordFirst(
    tx: Tx,
    actor: Actor,
    employee: EmployeeRow,
    reason: 'hire' | 'import',
    importId: string | null = null,
  ): Promise<void> {
    await tx.insert(salaryChanges).values({
      employeeId: employee.id,
      countryCode: employee.countryCode,
      amountMinor: employee.salaryAmountMinor,
      previousAmountMinor: null,
      currency: employee.salaryCurrency,
      effectiveDate: employee.salaryEffectiveDate,
      reason,
      importId,
      createdBy: actor.userId,
    });
  }
}
