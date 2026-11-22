import { describe, expect, it } from 'vitest';
import {
  auditEventSchema,
  createSalaryChangeResponseSchema,
  cursorPageSchema,
  employeeSchema,
  pageSchema,
  salaryHistoryResponseSchema,
} from '@acme/shared';
import { useTestApi } from '../../test/api.js';
import { anEmployee } from '../../test/builders.js';

/** The HTTP API for employees and country scope, employee lifecycle, against its own seeded Postgres with RLS on. */
const api = useTestApi();

describe('employees and country scope', () => {
  it('lists only in-scope employees for Country HR', async () => {
    const res = await api.indiaHr.get('/api/employees?pageSize=100&status=all');
    const page = pageSchema(employeeSchema).parse(res.body);
    expect(page.total).toBeGreaterThan(0);
    expect(new Set(page.items.map((e) => e.country))).toEqual(new Set(['IN']));
  });

  it('answers 404, not 403, for an out-of-scope employee', async () => {
    const gb = await api.employeeIn('GB');
    expect((await api.indiaHr.get(`/api/employees/${gb.id}`)).status).toBe(404);
    expect((await api.indiaHr.get(`/api/employees/${gb.id}/salary-changes`)).status).toBe(404);
    const write = await api.send(api.indiaHr, 'patch', `/api/employees/${gb.id}`, {
      firstName: 'X',
      version: gb.version,
    });
    expect(write.status).toBe(404);
  });

  it('rejects filters that are not in the catalogue', async () => {
    expect((await api.globalHr.get('/api/employees?country=ZZ')).status).toBe(400);
    expect((await api.globalHr.get('/api/employees?jobTitle=astronaut')).status).toBe(400);
  });

  it('rejects future hire and termination dates and implausible salaries', async () => {
    const base = {
      firstName: 'Future',
      lastName: 'Hire',
      email: 'future.hire@acme.test',
      country: 'IN',
      jobTitleId: 'data-analyst',
      departmentId: 'data',
      salaryAmountMinor: 100_000_000,
    };
    expect(
      (await api.send(api.globalHr, 'post', '/api/employees', { ...base, hireDate: '2027-06-01' }))
        .status,
    ).toBe(400);
    const huge = await api.send(api.globalHr, 'post', '/api/employees', {
      ...base,
      hireDate: '2026-11-02',
      salaryAmountMinor: Number.MAX_SAFE_INTEGER,
    });
    expect(huge.status).toBe(400);
    const someone = await api.employeeIn('IN');
    const leaving = await api.send(api.globalHr, 'post', `/api/employees/${someone.id}/terminate`, {
      terminationDate: '2027-01-31',
      reason: 'resignation',
      version: someone.version,
    });
    expect(leaving.status).toBe(400);
    expect(leaving.body.error.details[0].path).toBe('terminationDate');
  });

  it('answers 404 for an id that is not a uuid', async () => {
    expect((await api.globalHr.get('/api/employees/not-a-uuid')).status).toBe(404);
  });

  it('refuses to create an employee in a country outside the scope', async () => {
    const res = await api.send(
      api.indiaHr,
      'post',
      '/api/employees',
      anEmployee().named('Out', 'Of Scope').inCountry('GB').earning(5_000_000).build(),
    );
    expect(res.status).toBe(403);
  });

  it('requires one country to sort by salary', async () => {
    expect((await api.globalHr.get('/api/employees?sort=-salary')).status).toBe(400);
    const res = await api.globalHr.get('/api/employees?sort=-salary&country=IN&pageSize=5');
    const amounts = pageSchema(employeeSchema)
      .parse(res.body)
      .items.map((e) => e.salary.amountMinor);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it('rejects unknown keys such as currency on create', async () => {
    const res = await api.send(api.globalHr, 'post', '/api/employees', {
      firstName: 'A',
      lastName: 'B',
      email: 'a.b@acme.test',
      country: 'IN',
      jobTitleId: 'data-analyst',
      departmentId: 'data',
      hireDate: '2026-11-02',
      salaryAmountMinor: 100,
      currency: 'USD',
    });
    expect(res.status).toBe(400);
  });

  it('pages the audit log with a cursor and no duplicates', async () => {
    for (let i = 0; i < 5; i += 1) await api.hire();
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `&cursor=${cursor}` : '';
      const page = cursorPageSchema(auditEventSchema).parse(
        (await api.globalHr.get(`/api/audit-events?limit=2${query}`)).body,
      );
      for (const item of page.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 50);
    expect(seen.size).toBeGreaterThan(3);
  });

  it('exports CSV with formula cells neutralised and an audit row', async () => {
    await api.hire(
      anEmployee()
        .named('=HYPERLINK("x")', 'Formula')
        .withEmail('formula@acme.test')
        .inCountry('DE')
        .earning(6_000_000),
      api.globalHr,
    );
    const res = await api.globalHr.get('/api/employees/export.csv?country=DE&q=formula');
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`);
    expect(res.text).toContain('60000.00,EUR');
    const audit = cursorPageSchema(auditEventSchema).parse(
      (await api.globalHr.get('/api/audit-events?action=export.created&limit=1')).body,
    );
    expect(audit.items[0]?.action).toBe('export.created');
  });
});

describe('employee lifecycle', () => {
  const changePay = (id: string, body: object) =>
    api.send(api.indiaHr, 'post', `/api/employees/${id}/salary-changes`, {
      reason: 'annual_review',
      ...body,
    });

  it('creates an employee with a lower-cased email, the country currency and a new code', async () => {
    const res = await api.send(api.indiaHr, 'post', '/api/employees', anEmployee().build());
    expect(res.status, res.text).toBe(201);
    const employee = employeeSchema.parse(res.body);
    expect(employee.email).toMatch(/^asha\.rao\.\d+@acme\.test$/);
    expect(employee.salary).toEqual({ amountMinor: 180_000_000, currency: 'INR' });
    expect(employee.employeeCode).toMatch(/^ACM-\d{6}$/);
    expect(res.headers.location).toBe(`/api/employees/${employee.id}`);
  });

  it('refuses a second employee with the same email, whatever its case', async () => {
    const first = await api.hire();
    const dupe = await api.send(
      api.indiaHr,
      'post',
      '/api/employees',
      anEmployee().withEmail(first.email.toUpperCase()).build(),
    );
    expect(dupe.status).toBe(409);
  });

  it('bumps the version on edit and refuses an edit made from a stale version', async () => {
    const employee = await api.hire();
    const edited = await api.send(api.indiaHr, 'patch', `/api/employees/${employee.id}`, {
      jobTitleId: 'software-engineer',
      version: 1,
    });
    expect(employeeSchema.parse(edited.body).version).toBe(2);

    const stale = await api.send(api.indiaHr, 'patch', `/api/employees/${employee.id}`, {
      lastName: 'R',
      version: 1,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('stale_version');
  });

  it('only changes pay through a salary change, not an edit', async () => {
    const employee = await api.hire();
    const res = await api.send(api.indiaHr, 'patch', `/api/employees/${employee.id}`, {
      salaryAmountMinor: 1,
      version: 1,
    });
    expect(res.status).toBe(400);
  });

  it('refuses a pay change dated before the current pay or in the future', async () => {
    const employee = await api.hire();
    const before = await changePay(employee.id, {
      amountMinor: 190_000_000,
      effectiveDate: '2026-10-01',
      version: 1,
    });
    expect(before.status).toBe(400);
    const future = await changePay(employee.id, {
      amountMinor: 190_000_000,
      effectiveDate: '2026-12-01',
      version: 1,
    });
    expect(future.status).toBe(400);
  });

  it('records a pay change with the previous amount, newest first in the history', async () => {
    const employee = await api.hire();
    const res = await changePay(employee.id, {
      amountMinor: 198_000_000,
      effectiveDate: '2026-11-15',
      reason: 'market_adjustment',
      note: 'Benchmark',
      version: 1,
    });
    expect(res.status, res.text).toBe(201);
    const result = createSalaryChangeResponseSchema.parse(res.body);
    expect(result.salaryChange.previousAmount).toEqual({
      amountMinor: 180_000_000,
      currency: 'INR',
    });
    expect(result.employee.salary.amountMinor).toBe(198_000_000);
    expect(result.employee.version).toBe(2);

    const history = salaryHistoryResponseSchema.parse(
      (await api.indiaHr.get(`/api/employees/${employee.id}/salary-changes`)).body,
    );
    expect(history.items.map((h) => h.reason)).toEqual(['market_adjustment', 'hire']);
  });

  it('terminates once, and a leaver can no longer be edited', async () => {
    const employee = await api.hire();
    const terminate = (version: number) =>
      api.send(api.indiaHr, 'post', `/api/employees/${employee.id}/terminate`, {
        terminationDate: '2026-11-20',
        reason: 'resignation',
        version,
      });
    expect(employeeSchema.parse((await terminate(1)).body).status).toBe('terminated');
    expect((await terminate(2)).status).toBe(409);

    const edit = await api.send(api.indiaHr, 'patch', `/api/employees/${employee.id}`, {
      lastName: 'R',
      version: 2,
    });
    expect(edit.status).toBe(409);
  });

  it('writes an audit row for each step, with what changed', async () => {
    const employee = await api.hire();
    await api.send(api.indiaHr, 'patch', `/api/employees/${employee.id}`, {
      jobTitleId: 'software-engineer',
      version: 1,
    });
    await changePay(employee.id, {
      amountMinor: 198_000_000,
      effectiveDate: '2026-11-15',
      version: 2,
    });
    await api.send(api.indiaHr, 'post', `/api/employees/${employee.id}/terminate`, {
      terminationDate: '2026-11-20',
      reason: 'resignation',
      version: 3,
    });

    const audit = cursorPageSchema(auditEventSchema).parse(
      (await api.indiaHr.get(`/api/audit-events?entityType=employee&entityId=${employee.id}`)).body,
    );
    expect(audit.items.map((a) => a.action)).toEqual([
      'employee.terminated',
      'salary.changed',
      'employee.updated',
      'employee.created',
    ]);
    expect(audit.items[2]!.before).toEqual({ jobTitleId: 'data-analyst' });
    expect(audit.items[2]!.after).toEqual({ jobTitleId: 'software-engineer' });
  });
});
