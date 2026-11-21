import type { ImportRow } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { changeLabel, describeChanges, rowDetail, type ChangeContext } from './Import.utils';

const context: ChangeContext = {
  countries: [
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', minorUnits: 2 },
    { code: 'IN', name: 'India', currency: 'INR', minorUnits: 2 },
  ],
  jobTitles: [{ id: 'data-analyst', name: 'Data Analyst' }],
  departments: [{ id: 'data', name: 'Data' }],
};

const row = (overrides: Partial<ImportRow>): ImportRow => ({
  rowNumber: 2,
  outcome: 'update',
  employeeCode: 'ACM-001917',
  changes: {},
  errors: [],
  ...overrides,
});

describe('describeChanges', () => {
  const salaryUpdate = row({
    changes: {
      salaryAmountMinor: { from: 190_000_000, to: 195_000_000 },
      salaryEffectiveDate: { from: '2026-11-20', to: '2026-11-20' },
    },
  });

  it('formats update salaries in the import currency and drops unchanged entries', () => {
    expect(describeChanges(salaryUpdate, { ...context, updateCurrency: 'INR' })).toEqual([
      'Salary: ₹19,00,000 → ₹19,50,000',
    ]);
  });

  it('shows major units without a currency when the update currency is unknown', () => {
    expect(describeChanges(salaryUpdate, context)).toEqual(['Salary: 1,900,000 → 1,950,000']);
  });

  it("describes a new employee in words, with money in their country's currency", () => {
    const created = row({
      outcome: 'create',
      employeeCode: 'ACM-010004',
      changes: {
        salaryAmountMinor: { from: null, to: 5_200_050 },
        email: { from: null, to: 'qa@acme.example' },
        jobTitleId: { from: null, to: 'data-analyst' },
        departmentId: { from: null, to: 'data' },
        countryCode: { from: null, to: 'GB' },
        hireDate: { from: null, to: '2026-05-01' },
        salaryEffectiveDate: { from: null, to: '2026-11-20' },
        firstName: { from: null, to: 'Qa' },
      },
    });

    expect(describeChanges(created, { ...context, updateCurrency: 'INR' })).toEqual([
      'First name: Qa',
      'Work email: qa@acme.example',
      'Job title: Data Analyst',
      'Department: Data',
      'Country: United Kingdom',
      'Hire date: 1 May 2026',
      'Salary: £52,000.50',
      'Salary effective date: 20 Nov 2026',
    ]);
  });

  it('names catalogue changes on updates', () => {
    expect(
      describeChanges(
        row({ changes: { jobTitleId: { from: 'data-analyst', to: 'unknown-title' } } }),
        context,
      ),
    ).toEqual(['Job title: Data Analyst → unknown-title']);
  });
});

describe('rowDetail', () => {
  it('lists problems for error rows and says when nothing changes', () => {
    expect(
      rowDetail(
        row({ errors: [{ column: 'Email', message: 'Not a valid email address' }] }),
        context,
      ),
    ).toBe('Email: Not a valid email address');
    expect(
      rowDetail(row({ changes: { hireDate: { from: '2026-01-01', to: '2026-01-01' } } }), context),
    ).toBe('No changes');
  });
});

describe('changeLabel', () => {
  it('has a human label for every field and a readable fallback', () => {
    for (const field of [
      'firstName',
      'lastName',
      'email',
      'jobTitleId',
      'departmentId',
      'hireDate',
      'salaryAmountMinor',
      'salaryEffectiveDate',
      'countryCode',
    ]) {
      expect(changeLabel(field)).not.toBe(field);
    }
    expect(changeLabel('managerName')).toBe('Manager name');
  });
});
