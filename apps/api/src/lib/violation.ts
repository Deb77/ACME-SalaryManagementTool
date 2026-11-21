/**
 * A broken business rule as plain data: which rule, which field, and what to tell the user.
 * Domain rules return one (or null) and know nothing of HTTP; services turn it into an error.
 */
export interface RuleViolation {
  rule: string;
  /**
   * `invalid`: a field's value is wrong. `conflict`: the record's state forbids the change.
   * `stale`: the record changed since the user read it.
   */
  kind: 'invalid' | 'conflict' | 'stale';
  field?: string;
  message: string;
}

export const invalidField = (rule: string, field: string, message: string): RuleViolation => ({
  rule,
  kind: 'invalid',
  field,
  message,
});
