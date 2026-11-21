import { invalid } from '../../lib/errors.js';

export interface HireDateCheck {
  hireDate: string;
  /** Today in the organisation's calendar (ISO date). */
  today: string;
  /** When editing: the current salary's effective date, which the hire date may not pass. */
  salaryEffectiveDate?: string;
}

/** v1 has no future-dated events, so hire and termination dates are today or earlier. */
export function checkNotInFuture(field: string, date: string, today: string, what: string): void {
  if (date > today) throw invalid(field, `${what} cannot be in the future yet`);
}

/**
 * v1 has no future-dated events, so a hire date is today or earlier; when editing it also may
 * not fall after the current salary took effect. Pure: throws the AppError the client shows.
 */
export function checkHireDate({ hireDate, today, salaryEffectiveDate }: HireDateCheck): void {
  checkNotInFuture('hireDate', hireDate, today, 'The hire date');
  if (salaryEffectiveDate !== undefined && hireDate > salaryEffectiveDate) {
    throw invalid(
      'hireDate',
      `Must be on or before the current salary's effective date (${salaryEffectiveDate})`,
    );
  }
}
