import { describe, expect, it } from 'vitest';
import { AppError, toAppError } from './errors.js';

describe('toAppError', () => {
  it('reports a value problem on its field', () => {
    const error = toAppError({
      rule: 'future_date',
      kind: 'invalid',
      field: 'hireDate',
      message: 'Not yet',
    });
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('validation_error');
    expect(error.details).toEqual([{ path: 'hireDate', message: 'Not yet' }]);
  });

  it('reports a change the record’s state forbids as a conflict', () => {
    const error = toAppError({ rule: 'employee_left', kind: 'conflict', message: 'Has left' });
    expect({ code: error.code, message: error.message }).toEqual({
      code: 'conflict',
      message: 'Has left',
    });
  });

  it('reports an edit made from an old copy as a stale version', () => {
    const error = toAppError({ rule: 'stale_version', kind: 'stale', message: 'Changed' });
    expect(error.code).toBe('stale_version');
  });
});
