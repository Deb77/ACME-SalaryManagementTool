import type { salaryChanges } from '../../db/schema/index.js';
import { invalidField, type RuleViolation } from '../../lib/violation.js';

export type SalaryChangeReason = (typeof salaryChanges.reason.enumValues)[number];

export interface SalaryChangeCheck {
  /** The employee as locked for this change. */
  current: {
    status: string;
    version: number;
    salaryAmountMinor: number;
    salaryEffectiveDate: string;
  };
  input: {
    amountMinor: number;
    effectiveDate: string;
    reason: SalaryChangeReason;
    /** The version the user saw; omitted by import, which locks and re-reads instead. */
    version?: number;
    importId?: string | null;
  };
  /** Today in the organisation's calendar (ISO date). */
  today: string;
}

/**
 * The rules a salary change must pass, in the order users meet them: the first one broken, or
 * null when the change may be written. Pure: no database, no clock, no HTTP.
 */
export function checkSalaryChange({
  current,
  input,
  today,
}: SalaryChangeCheck): RuleViolation | null {
  if (input.version !== undefined && input.version !== current.version) {
    return {
      rule: 'stale_version',
      kind: 'stale',
      message: 'Someone else changed this record. Reload it and try again.',
    };
  }
  if (current.status !== 'active') {
    return {
      rule: 'employee_left',
      kind: 'conflict',
      message: 'This employee has left; their pay cannot change',
    };
  }
  if (input.effectiveDate < current.salaryEffectiveDate) {
    return invalidField(
      'before_latest_entry',
      'effectiveDate',
      `Must be on or after the latest salary entry (${current.salaryEffectiveDate}). Fix a past amount with a correction.`,
    );
  }
  const fromImport = input.reason === 'import' || input.reason === 'import_undo';
  if (!fromImport && input.effectiveDate > today) {
    return invalidField(
      'future_date',
      'effectiveDate',
      'Future-dated changes are not supported yet',
    );
  }
  const correction = input.reason === 'correction' || Boolean(input.importId);
  if (input.amountMinor === current.salaryAmountMinor && !correction) {
    return invalidField(
      'same_amount',
      'amountMinor',
      'The new salary is the same as the current one',
    );
  }
  return null;
}
