import { describe, expect, it } from 'vitest';
import {
  createEmployeeRequestSchema,
  exportEmployeesQuerySchema,
  listEmployeesQuerySchema,
  terminateEmployeeRequestSchema,
  updateEmployeeRequestSchema,
} from './employee.schema.js';

const newJoiner = {
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha.rao@acme.test',
  country: 'IN',
  jobTitleId: 'data-analyst',
  departmentId: 'analytics',
  hireDate: '2026-11-02',
  salaryAmountMinor: 180_000_000,
};

describe('createEmployeeRequestSchema', () => {
  it('accepts a new joiner without an employee code (the server assigns one)', () => {
    expect(createEmployeeRequestSchema.parse(newJoiner)).toEqual(newJoiner);
  });

  it('rejects a client-supplied currency, because currency follows the country', () => {
    const result = createEmployeeRequestSchema.safeParse({ ...newJoiner, currency: 'USD' });
    expect(result.success).toBe(false);
  });

  it('rejects free-text job titles that are not catalogue ids', () => {
    const result = createEmployeeRequestSchema.safeParse({ ...newJoiner, jobTitleId: 'Data Guru' });
    expect(result.success).toBe(false);
  });

  it('rejects a date with a time component', () => {
    const result = createEmployeeRequestSchema.safeParse({
      ...newJoiner,
      hireDate: '2026-11-02T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateEmployeeRequestSchema', () => {
  it('accepts a partial update with the version the user saw', () => {
    const body = { jobTitleId: 'senior-data-analyst', version: 4 };
    expect(updateEmployeeRequestSchema.parse(body)).toEqual(body);
  });

  it('refuses salary edits, which must go through a salary change', () => {
    const result = updateEmployeeRequestSchema.safeParse({ salaryAmountMinor: 1, version: 4 });
    expect(result.success).toBe(false);
  });

  it('refuses country moves and status changes', () => {
    expect(updateEmployeeRequestSchema.safeParse({ country: 'GB', version: 4 }).success).toBe(
      false,
    );
    expect(
      updateEmployeeRequestSchema.safeParse({ status: 'terminated', version: 4 }).success,
    ).toBe(false);
  });

  it('requires the version for optimistic concurrency', () => {
    expect(updateEmployeeRequestSchema.safeParse({ firstName: 'Asha' }).success).toBe(false);
  });

  it('rejects an update that changes nothing', () => {
    expect(updateEmployeeRequestSchema.safeParse({ version: 4 }).success).toBe(false);
  });
});

describe('terminateEmployeeRequestSchema', () => {
  it('requires a date and a reason from the list', () => {
    const body = { terminationDate: '2026-12-31', reason: 'resignation', version: 2 };
    expect(terminateEmployeeRequestSchema.parse(body)).toEqual(body);
    expect(terminateEmployeeRequestSchema.safeParse({ ...body, reason: 'bored' }).success).toBe(
      false,
    );
  });
});

describe('listEmployeesQuerySchema', () => {
  it('defaults to active employees sorted by name, first page', () => {
    expect(listEmployeesQuerySchema.parse({})).toEqual({
      q: undefined,
      country: undefined,
      department: undefined,
      jobTitle: undefined,
      status: 'active',
      sort: { field: 'name', direction: 'asc' },
      page: 1,
      pageSize: 25,
    });
  });

  it('parses the filters the directory sends', () => {
    const query = listEmployeesQuerySchema.parse({
      q: '  rao ',
      country: 'IN,GB',
      jobTitle: 'data-analyst',
      status: 'all',
      sort: '-hireDate',
      page: '2',
    });

    expect(query).toMatchObject({
      q: 'rao',
      country: ['IN', 'GB'],
      jobTitle: ['data-analyst'],
      status: 'all',
      sort: { field: 'hireDate', direction: 'desc' },
      page: 2,
    });
  });

  it('treats a blank search box as no search', () => {
    expect(listEmployeesQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('allows sorting by salary within one country', () => {
    const query = listEmployeesQuerySchema.parse({ country: 'IN', sort: '-salary' });
    expect(query.sort).toEqual({ field: 'salary', direction: 'desc' });
  });

  it('refuses to sort by salary across countries, since currencies differ', () => {
    const result = listEmployeesQuerySchema.safeParse({ country: 'IN,GB', sort: 'salary' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['sort']);
  });
});

describe('exportEmployeesQuerySchema', () => {
  it('takes the same filters as the list but no paging', () => {
    const query = exportEmployeesQuerySchema.parse({ country: 'IN', page: '3' });
    expect(query.country).toEqual(['IN']);
    expect(query).not.toHaveProperty('page');
  });
});
