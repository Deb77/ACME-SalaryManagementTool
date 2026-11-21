import type { SalaryChange } from '@acme/shared';
import type { Actor } from '../../auth/actor.js';
import type { Tx } from '../../db/scope.js';
import type { Clock } from '../../lib/clock.js';
import { AppError, invalid, notFound } from '../../lib/errors.js';
import type { AiRepository } from '../ai/ai.repository.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EmployeeRepository, EmployeeRow } from '../employees/employee.repository.js';
import type { SalaryChangeRepository, SalaryChangeRow } from './salary.repository.js';
import { checkSalaryChange, type SalaryChangeReason } from './salary.rules.js';

export interface SalaryChangeInput {
  employeeId: string;
  amountMinor: number;
  effectiveDate: string;
  reason: SalaryChangeReason;
  note?: string | null;
  /** The version the user saw; omitted by import, which locks and re-reads instead. */
  version?: number;
  importId?: string | null;
  aiDraftId?: string | null;
}

function toSalaryChange(
  row: SalaryChangeRow,
  createdBy: { id: string; name: string },
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
    aiDraftId: row.aiDraftId,
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
    private readonly aiDrafts: AiRepository,
    private readonly changes: SalaryChangeRepository,
  ) {}

  /**
   * An Ask AI draft can be confirmed once, by its owner, for its employee, while nothing about the
   * employee has changed and within 7 days (decision #39). RLS hides other users' drafts.
   */
  private async useDraft(tx: Tx, draftId: string, employee: EmployeeRow) {
    const draft = await this.aiDrafts.lockDraft(tx, draftId);
    if (!draft) throw notFound('Ask AI draft not found');
    if (draft.employeeId !== employee.id) {
      throw invalid('aiDraftId', 'This draft is for a different employee');
    }
    if (draft.appliedAt) {
      throw new AppError(
        'draft_applied',
        'This draft has already been saved. Ask again for a new suggestion.',
      );
    }
    if (draft.versionAtDraft !== employee.version || this.clock.now() >= draft.expiresAt) {
      throw new AppError('draft_stale', 'This draft is out of date — ask again.');
    }
  }

  async history(tx: Tx, employeeId: string): Promise<SalaryChange[]> {
    const employee = await this.employees.get(tx, employeeId);
    if (!employee) throw notFound('Employee not found');
    const rows = await this.changes.history(tx, employeeId);
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
    if (input.aiDraftId) await this.useDraft(tx, input.aiDraftId, before);
    checkSalaryChange({ current: before, input, today: this.clock.today() });

    const row = await this.changes.insert(tx, {
      employeeId: before.id,
      countryCode: before.countryCode,
      amountMinor: input.amountMinor,
      previousAmountMinor: before.salaryAmountMinor,
      currency: before.salaryCurrency,
      effectiveDate: input.effectiveDate,
      reason: input.reason,
      note: input.note ?? null,
      importId: input.importId ?? null,
      aiDraftId: input.aiDraftId ?? null,
      createdBy: actor.userId,
    });
    if (input.aiDraftId)
      await this.aiDrafts.markDraftApplied(tx, input.aiDraftId, this.clock.now());

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
      salaryChange: toSalaryChange(row, { id: actor.userId, name: actor.name }),
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
    await this.changes.insert(tx, {
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
