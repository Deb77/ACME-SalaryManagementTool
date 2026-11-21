import { invalidField, type RuleViolation } from '../../lib/violation.js';

export interface HireDateCheck {
  hireDate: string;
  /** Today in the organisation's calendar (ISO date). */
  today: string;
  /** When editing: the current salary's effective date, which the hire date may not pass. */
  salaryEffectiveDate?: string;
}

export interface TerminationDateCheck {
  terminationDate: string;
  hireDate: string;
  /** Today in the organisation's calendar (ISO date). */
  today: string;
}

/** v1 has no future-dated events, so hire and termination dates are today or earlier. */
function notInFuture(field: string, date: string, today: string, what: string) {
  return date > today
    ? invalidField('future_date', field, `${what} cannot be in the future yet`)
    : null;
}

/**
 * A hire date is today or earlier; when editing it also may not fall after the current salary
 * took effect. Returns the broken rule, or null. Pure.
 */
export function checkHireDate({
  hireDate,
  today,
  salaryEffectiveDate,
}: HireDateCheck): RuleViolation | null {
  const future = notInFuture('hireDate', hireDate, today, 'The hire date');
  if (future) return future;
  if (salaryEffectiveDate !== undefined && hireDate > salaryEffectiveDate) {
    return invalidField(
      'hired_after_pay',
      'hireDate',
      `Must be on or before the current salary's effective date (${salaryEffectiveDate})`,
    );
  }
  return null;
}

/** Someone leaves today or earlier, and not before they joined. Returns the broken rule, or null. Pure. */
export function checkTerminationDate({
  terminationDate,
  hireDate,
  today,
}: TerminationDateCheck): RuleViolation | null {
  const future = notInFuture('terminationDate', terminationDate, today, 'The termination date');
  if (future) return future;
  if (terminationDate < hireDate) {
    return invalidField(
      'left_before_hired',
      'terminationDate',
      `Must be on or after the hire date (${hireDate})`,
    );
  }
  return null;
}
