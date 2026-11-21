import { describe, expect, it } from 'vitest';
import { Catalogue } from '../meta/catalogue.service.js';
import type { EmployeeRow } from '../employees/employee.repository.js';
import { parseAmountMinor, parseDate, planRows, summarise } from './import.plan.js';
import { suggestMapping } from './import.parser.js';

const catalogue = new Catalogue(
  [
    { code: 'IN', name: 'India', currency: 'INR', minorUnits: 2 },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', minorUnits: 2 },
  ],
  [{ id: 'data', name: 'Data' }],
  [{ id: 'data-analyst', name: 'Data Analyst' }],
  '2026-11-01',
  { INR: 0.012, GBP: 1.27 },
);

const existing = {
  id: '00000000-0000-4000-8000-000000000001',
  employeeCode: 'ACM-000001',
  firstName: 'Asha',
  lastName: 'Rao',
  email: 'asha@acme.test',
  countryCode: 'IN',
  jobTitleId: 'data-analyst',
  departmentId: 'data',
  hireDate: '2024-01-01',
  status: 'active',
  salaryAmountMinor: 150_000_000,
  salaryCurrency: 'INR',
  salaryEffectiveDate: '2025-04-01',
} as EmployeeRow;

const columns = ['Code', 'First', 'Last', 'Email', 'Country', 'Title', 'Dept', 'Hired', 'Salary'];
const mapping = {
  employeeCode: 'Code',
  firstName: 'First',
  lastName: 'Last',
  email: 'Email',
  country: 'Country',
  jobTitle: 'Title',
  department: 'Dept',
  hireDate: 'Hired',
  salaryAmount: 'Salary',
};
const ctx = {
  catalogue,
  countries: ['IN'],
  byCode: new Map([[existing.employeeCode, existing]]),
  byEmail: new Map([[existing.email, existing]]),
  today: '2026-11-20',
};

describe('parseDate', () => {
  it('reads ISO and day-first dates and rejects impossible ones', () => {
    expect(parseDate('2026-11-02')).toBe('2026-11-02');
    expect(parseDate('02/11/2026')).toBe('2026-11-02');
    expect(parseDate('2026-02-30')).toBeUndefined();
    expect(parseDate('next week')).toBeUndefined();
  });
});

describe('parseAmountMinor', () => {
  it('accepts grouping and currency symbols, never floats', () => {
    expect(parseAmountMinor('18,00,000', 2)).toBe(180_000_000);
    expect(parseAmountMinor('£52,000.50', 2)).toBe(5_200_050);
    expect(parseAmountMinor('1.005', 2)).toBeUndefined();
    expect(parseAmountMinor('-5', 2)).toBeUndefined();
    expect(parseAmountMinor('0', 2)).toBeUndefined();
  });
});

describe('suggestMapping', () => {
  it('matches common HR spreadsheet headings', () => {
    expect(suggestMapping(['Emp ID', 'Name', 'Surname', 'E-mail', 'Annual CTC', 'DOJ'])).toEqual({
      employeeCode: 'Emp ID',
      firstName: 'Name',
      lastName: 'Surname',
      email: 'E-mail',
      salaryAmount: 'Annual CTC',
      hireDate: 'DOJ',
    });
  });
});

describe('planRows', () => {
  it('sorts rows into create, update, unchanged and error with reasons', () => {
    const rows = [
      [
        'ACM-000001',
        'Asha',
        'Rao',
        'asha@acme.test',
        'IN',
        'Data Analyst',
        'Data',
        '2024-01-01',
        '1500000',
      ],
      [
        'ACM-000001',
        'Asha',
        'Rao',
        'asha@acme.test',
        'IN',
        'Data Analyst',
        'Data',
        '2024-01-01',
        '1600000',
      ],
      [
        '',
        'Neha',
        'Kapoor',
        'neha@acme.test',
        'IN',
        'data-analyst',
        'data',
        '2026-11-03',
        '16,00,000',
      ],
      ['', 'Tom', 'Smith', 'tom@acme.test', 'GB', 'Data Analyst', 'Data', '2026-11-03', '50000'],
    ];
    const plan = planRows(
      columns,
      rows,
      { mapping, defaults: { salaryEffectiveDate: '2026-11-01' } },
      ctx,
    );
    expect(plan.map((r) => r.outcome)).toEqual(['unchanged', 'error', 'create', 'error']);
    // The second row repeats the first employee.
    expect(plan[1]!.errors[0]!.message).toMatch(/Same employee as row 2/);
    // A default effective date before the hire date moves to the hire date for a new joiner.
    expect(plan[2]!.values.salaryEffectiveDate).toBe('2026-11-03');
    expect(plan[3]!.errors[0]!.message).toMatch(/GB is outside your countries/);
    expect(summarise(plan)).toEqual({ rows: 4, create: 1, update: 0, unchanged: 1, error: 2 });
  });

  it('records field-level changes and needs an effective date for a pay change', () => {
    const row = [
      'ACM-000001',
      'Asha',
      'Rao',
      'asha@acme.test',
      'IN',
      'Data Analyst',
      'Data',
      '2024-01-01',
      '1600000',
    ];
    const withoutDate = planRows(columns, [row], { mapping }, ctx)[0]!;
    expect(withoutDate.outcome).toBe('error');
    const withDate = planRows(
      columns,
      [row],
      { mapping, defaults: { salaryEffectiveDate: '2026-11-01' } },
      ctx,
    )[0]!;
    expect(withDate.outcome).toBe('update');
    expect(withDate.changes.salaryAmountMinor).toEqual({ from: 150_000_000, to: 160_000_000 });
  });

  it('rejects country moves', () => {
    const row = [
      'ACM-000001',
      'Asha',
      'Rao',
      'asha@acme.test',
      'GB',
      'Data Analyst',
      'Data',
      '2024-01-01',
      '',
    ];
    const plan = planRows(columns, [row], { mapping }, { ...ctx, countries: ['IN', 'GB'] })[0]!;
    expect(plan.outcome).toBe('error');
    expect(plan.errors[0]!.message).toMatch(/not supported/);
  });
});
