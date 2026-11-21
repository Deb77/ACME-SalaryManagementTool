import type {
  employees as employeesTable,
  salaryChanges as salaryChangesTable,
} from '../schema/index.js';
import {
  countryCurrency,
  countryPayFactor,
  countryWeights,
  names,
  roundingStep,
  terminationReasons,
  titles,
  usdPerUnit,
  type CountryCode,
} from './data.js';
import { createRandom, type Random } from './random.js';

export interface GenerateOptions {
  employees: number;
  /** Same seed, same people. */
  seed: number;
  /** "Today" for the data: no hire, change or leaving date is after it. */
  asOf: string;
  /** The user recorded as creating every salary entry. */
  createdBy: string;
}

export type NewEmployee = typeof employeesTable.$inferInsert & { id: string };
export type NewSalaryChange = typeof salaryChangesTable.$inferInsert;
type SalaryChangeReason = NewSalaryChange['reason'];

export interface SeedData {
  employees: NewEmployee[];
  salaryChanges: NewSalaryChange[];
}

const FIRST_HIRE = '2014-01-06';
const TERMINATED_SHARE = 0.05;
/** Chance of a pay change in each full year someone has been employed. */
const CHANGE_PER_YEAR = 0.25;
const MAX_LATER_CHANGES = 4;
const MINOR_PER_MAJOR = 100; // every seeded currency has 2 minor units

const DAY_MS = 86_400_000;
const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const fromDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** ASCII, lower-case local part for an email, e.g. "Müller" → "muller", "Van Dyk" → "vandyk". */
export function emailPart(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Redraws per person before giving up; the pools are sized so a few tries are enough. */
const NAME_TRIES = 200;

/**
 * A first and last name nobody else in the seed has, drawn from the country's pools. Names are
 * compared by their email form, so "Chloé Roy" and "Chloe Roy" count as the same person, and the
 * email is then unique without a number on the end.
 */
function uniqueName(random: Random, country: CountryCode, used: Set<string>) {
  const pool = names[country];
  for (let attempt = 0; attempt < NAME_TRIES; attempt += 1) {
    const firstName = random.pick(pool.first);
    const lastName = random.pick(pool.last);
    const local = `${emailPart(firstName)}.${emailPart(lastName)}`;
    if (!used.has(local)) {
      used.add(local);
      return { firstName, lastName, local };
    }
  }
  throw new RangeError(`Ran out of unique names for ${country}; add more to seed/names.ts`);
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

const LATER_REASONS = {
  annual_review: 65,
  promotion: 15,
  market_adjustment: 15,
  correction: 5,
} satisfies Partial<Record<SalaryChangeReason, number>>;

/** Pay rise (or, for corrections, small move either way) for one change. */
function changeFactor(random: Random, reason: keyof typeof LATER_REASONS): number {
  switch (reason) {
    case 'annual_review':
      return 1.03 + random.next() * 0.05;
    case 'promotion':
      return 1.1 + random.next() * 0.08;
    case 'market_adjustment':
      return 1.04 + random.next() * 0.06;
    case 'correction':
      return random.next() < 0.5 ? 0.97 : 1.03;
  }
}

/** `count` distinct days in [from, to], ascending. */
function distinctDays(random: Random, from: number, to: number, count: number): number[] {
  const days = new Set<number>();
  while (days.size < Math.min(count, to - from + 1)) days.add(random.int(from, to));
  return [...days].sort((a, b) => a - b);
}

/**
 * Builds synthetic employees and their salary history. Pure and deterministic: the current
 * salary is drawn from a band for the title and country, and the history is worked backwards
 * from it, so insights look plausible whatever the history.
 */
export function generateSeedData({
  employees: count,
  seed,
  asOf,
  createdBy,
}: GenerateOptions): SeedData {
  if (!Number.isInteger(count) || count < 1 || count > 999_999) {
    throw new RangeError('employees must be a whole number from 1 to 999,999');
  }
  const random = createRandom(seed);
  const today = toDay(asOf);
  const firstHire = toDay(FIRST_HIRE);
  const titleWeights = Object.fromEntries(Object.entries(titles).map(([id, t]) => [id, t.weight]));
  const usedNames = new Set<string>();

  const employees: SeedData['employees'] = [];
  const salaryChanges: SeedData['salaryChanges'] = [];

  for (let n = 1; n <= count; n += 1) {
    const country = random.weighted(countryWeights) as CountryCode;
    const titleId = random.weighted(titleWeights);
    const title = titles[titleId]!;
    const currency = countryCurrency[country];
    const step = roundingStep[currency]!;

    const { firstName, lastName, local } = uniqueName(random, country, usedNames);
    const email = `${local}@acme.example`;

    const hire = random.int(firstHire, today - 30);
    const terminated = random.next() < TERMINATED_SHARE && today - hire > 120;
    const end = terminated ? random.int(hire + 90, today) : today;

    // Current salary: the title's US median, scaled to the country, spread about ±18%.
    const medianLocal = (title.usMedianUsd * countryPayFactor[country]) / usdPerUnit[currency]!;
    const current = roundTo(medianLocal * Math.exp(random.normal(0, 0.18)), step);

    // Later changes, at least six months after hire and no later than the leaving date.
    const years = Math.floor((end - hire) / 365);
    let later = 0;
    for (let year = 0; year < Math.min(years, 12); year += 1) {
      if (random.next() < CHANGE_PER_YEAR) later += 1;
    }
    later = Math.min(later, MAX_LATER_CHANGES);
    const changeDays = end - hire > 180 ? distinctDays(random, hire + 180, end, later) : [];
    const reasons = changeDays.map(() => random.weighted(LATER_REASONS));

    // Work backwards from the current salary to the amount at hire.
    const amounts = [current];
    for (let i = reasons.length - 1; i >= 0; i -= 1) {
      const after = amounts[0]!;
      let before = roundTo(after / changeFactor(random, reasons[i]!), step);
      if (before === after) before = after > step ? after - step : after + step;
      amounts.unshift(before);
    }

    const id = random.uuid();
    const effectiveDays = [hire, ...changeDays];
    effectiveDays.forEach((day, i) => {
      const reason: SalaryChangeReason = i === 0 ? 'hire' : reasons[i - 1]!;
      salaryChanges.push({
        id: random.uuid(),
        employeeId: id,
        countryCode: country,
        amountMinor: amounts[i]! * MINOR_PER_MAJOR,
        previousAmountMinor: i === 0 ? null : amounts[i - 1]! * MINOR_PER_MAJOR,
        currency,
        effectiveDate: fromDay(day),
        reason,
        note: reason === 'correction' ? 'Corrected a keying error in the previous entry' : null,
        createdAt: new Date(`${fromDay(day)}T09:00:00Z`),
        createdBy: createdBy,
      });
    });

    const lastChange = effectiveDays[effectiveDays.length - 1]!;
    employees.push({
      id,
      employeeCode: `ACM-${String(n).padStart(6, '0')}`,
      firstName: firstName,
      lastName: lastName,
      email,
      countryCode: country,
      jobTitleId: titleId,
      departmentId: title.department,
      hireDate: fromDay(hire),
      status: terminated ? 'terminated' : 'active',
      terminationDate: terminated ? fromDay(end) : null,
      terminationReason: terminated ? random.pick(terminationReasons) : null,
      terminationNote: null,
      salaryAmountMinor: current * MINOR_PER_MAJOR,
      salaryCurrency: currency,
      salaryEffectiveDate: fromDay(lastChange),
      version: 1 + changeDays.length + (terminated ? 1 : 0),
      createdAt: new Date(`${fromDay(hire)}T09:00:00Z`),
      updatedAt: new Date(`${fromDay(Math.max(lastChange, terminated ? end : hire))}T09:00:00Z`),
    });
  }

  return { employees, salaryChanges };
}
