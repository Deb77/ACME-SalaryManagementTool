import type { salaryChanges } from '../../db/schema/index.js';
import { conflict, invalid, staleVersion } from '../../lib/errors.js';

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
 * The rules a salary change must pass, in the order users meet them. Throws the AppError the
 * client shows; returns nothing when the change may be written. Pure: no database, no clock.
 */
export function checkSalaryChange({ current, input, today }: SalaryChangeCheck): void {
  if (input.version !== undefined && input.version !== current.version) throw staleVersion();
  if (current.status !== 'active') {
    throw conflict('This employee has left; their pay cannot change');
  }
  if (input.effectiveDate < current.salaryEffectiveDate) {
    throw invalid(
      'effectiveDate',
      `Must be on or after the latest salary entry (${current.salaryEffectiveDate}). Fix a past amount with a correction.`,
    );
  }
  const fromImport = input.reason === 'import' || input.reason === 'import_undo';
  if (!fromImport && input.effectiveDate > today) {
    throw invalid('effectiveDate', 'Future-dated changes are not supported yet');
  }
  const correction = input.reason === 'correction' || Boolean(input.importId);
  if (input.amountMinor === current.salaryAmountMinor && !correction) {
    throw invalid('amountMinor', 'The new salary is the same as the current one');
  }
}
