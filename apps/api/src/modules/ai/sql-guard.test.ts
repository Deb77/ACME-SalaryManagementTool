import { describe, expect, it } from 'vitest';
import { checkSql } from './sql-guard.js';

describe('checkSql', () => {
  it.each([
    'select exp(avg(ln(salary_amount_minor))) from employees',
    'select log10(max(salary_amount_minor)), log(2, 8), cbrt(27), pi() from employees',
    'select regr_intercept(salary_amount_minor, 1), covar_pop(salary_amount_minor, 1) from employees',
    'select date(hire_date) from employees',
  ])('allows the harmless maths and date function in %s', async (sqlText) => {
    expect(await checkSql(sqlText)).toMatchObject({ ok: true });
  });

  it('names the allowed functions when it refuses one, so the query can be rewritten', async () => {
    const result = await checkSql('select pg_sleep(10)');
    expect(result).toMatchObject({ ok: false, code: 'forbidden_function' });
    expect(result.ok || result.message).toMatch(
      /^Function "pg_sleep" is not allowed\. Allowed functions: .*\bln\b/,
    );
  });
});
