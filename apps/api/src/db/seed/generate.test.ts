import { describe, expect, it } from 'vitest';
import { employeeCodeSchema } from '@acme/shared';
import { countryCurrency, names } from './data.js';
import { emailPart, generateSeedData } from './generate.js';

const options = {
  employees: 10_000,
  seed: 20261120,
  asOf: '2026-11-01',
  createdBy: '00000000-0000-4000-8000-000000000001',
};
const data = generateSeedData(options);

describe('generateSeedData', () => {
  it('makes the requested number of employees, with two to three salary entries each on average', () => {
    expect(data.employees).toHaveLength(10_000);
    const perEmployee = data.salaryChanges.length / data.employees.length;
    expect(perEmployee).toBeGreaterThan(2);
    expect(perEmployee).toBeLessThan(3);
  });

  it('is reproducible: the same seed gives the same people', () => {
    const again = generateSeedData({ ...options, employees: 50 });
    expect(again.employees).toEqual(data.employees.slice(0, 50));
    expect(generateSeedData({ ...options, employees: 50, seed: 1 }).employees).not.toEqual(
      again.employees,
    );
  });

  it('gives every employee a unique, valid code, email and id', () => {
    const codes = new Set(data.employees.map((e) => e.employeeCode));
    const emails = new Set(data.employees.map((e) => e.email));
    const ids = new Set(data.employees.map((e) => e.id));
    expect(codes.size).toBe(10_000);
    expect(emails.size).toBe(10_000);
    expect(ids.size).toBe(10_000);
    for (const employee of data.employees) {
      expect(employeeCodeSchema.safeParse(employee.employeeCode).success).toBe(true);
      expect(employee.email).toMatch(/^[a-z]+\.[a-z]+@acme\.example$/);
    }
  });

  it('gives every employee a different full name', () => {
    const fullNames = new Set(data.employees.map((e) => `${e.firstName} ${e.lastName}`));
    expect(fullNames.size).toBe(10_000);
  });

  it('pays everyone in their country’s currency, in every country', () => {
    const countries = new Set(data.employees.map((e) => e.countryCode));
    expect(countries.size).toBe(8);
    for (const employee of data.employees) {
      expect(employee.salaryCurrency).toBe(
        countryCurrency[employee.countryCode as keyof typeof countryCurrency],
      );
    }
  });

  it('keeps about 5% as leavers, each with a reason and a date after hire', () => {
    const leavers = data.employees.filter((e) => e.status === 'terminated');
    expect(leavers.length / data.employees.length).toBeGreaterThan(0.03);
    expect(leavers.length / data.employees.length).toBeLessThan(0.07);
    for (const leaver of leavers) {
      expect(leaver.terminationReason).toBeTruthy();
      expect(leaver.terminationDate! >= leaver.hireDate).toBe(true);
    }
  });

  it('builds a history that starts at hire, chains amounts and ends at the current salary', () => {
    const byEmployee = new Map<string, typeof data.salaryChanges>();
    for (const change of data.salaryChanges) {
      byEmployee.set(change.employeeId, [...(byEmployee.get(change.employeeId) ?? []), change]);
    }
    for (const employee of data.employees) {
      const history = byEmployee.get(employee.id)!;
      expect(history[0]).toMatchObject({
        reason: 'hire',
        previousAmountMinor: null,
        effectiveDate: employee.hireDate,
      });
      for (let i = 1; i < history.length; i += 1) {
        expect(history[i]!.previousAmountMinor).toBe(history[i - 1]!.amountMinor);
        expect(history[i]!.amountMinor).not.toBe(history[i - 1]!.amountMinor);
        expect(history[i]!.effectiveDate > history[i - 1]!.effectiveDate).toBe(true);
      }
      const latest = history[history.length - 1]!;
      expect(latest.amountMinor).toBe(employee.salaryAmountMinor);
      expect(latest.effectiveDate).toBe(employee.salaryEffectiveDate);
      expect(latest.effectiveDate <= (employee.terminationDate ?? options.asOf)).toBe(true);
      for (const change of history) {
        expect(change.countryCode).toBe(employee.countryCode);
        expect(change.currency).toBe(employee.salaryCurrency);
        if (change.reason === 'correction') expect(change.note).toBeTruthy();
      }
    }
  });

  it('puts typical pay in a plausible range (US software engineers around $125k)', () => {
    const salaries = data.employees
      .filter((e) => e.countryCode === 'US' && e.jobTitleId === 'software-engineer')
      .map((e) => e.salaryAmountMinor / 100)
      .sort((a, b) => a - b);
    const median = salaries[Math.floor(salaries.length / 2)]!;
    expect(median).toBeGreaterThan(110_000);
    expect(median).toBeLessThan(140_000);
  });

  it('rejects a count it cannot give codes to', () => {
    expect(() => generateSeedData({ ...options, employees: 0 })).toThrow(RangeError);
    expect(() => generateSeedData({ ...options, employees: 1_000_000 })).toThrow(RangeError);
  });
});

describe('name pools', () => {
  it('has no repeats within a country', () => {
    for (const [country, pool] of Object.entries(names)) {
      expect(new Set(pool.first).size, `${country} first names`).toBe(pool.first.length);
      expect(new Set(pool.last).size, `${country} last names`).toBe(pool.last.length);
    }
  });
});

describe('emailPart', () => {
  it('strips accents, spaces and case', () => {
    expect(emailPart('Müller')).toBe('muller');
    expect(emailPart('Van Dyk')).toBe('vandyk');
    expect(emailPart('João')).toBe('joao');
    expect(emailPart('Wei Ling')).toBe('weiling');
  });
});
