/**
 * Inputs for the synthetic seed: how people spread across countries and titles, typical pay
 * and common names (names.ts). All of it is invented; it only needs to look plausible in the insights.
 */

export const countryCurrency = {
  US: 'USD',
  GB: 'GBP',
  DE: 'EUR',
  CA: 'CAD',
  IN: 'INR',
  SG: 'SGD',
  AU: 'AUD',
  BR: 'BRL',
} as const;

export type CountryCode = keyof typeof countryCurrency;

/** Share of headcount per country (sums to 100). */
export const countryWeights: Record<CountryCode, number> = {
  IN: 30,
  US: 20,
  GB: 12,
  DE: 9,
  CA: 8,
  AU: 8,
  SG: 7,
  BR: 6,
};

/** USD per one unit of each currency; the same fixed rates as the catalogue migration. */
export const usdPerUnit: Record<string, number> = {
  USD: 1,
  GBP: 1.27,
  EUR: 1.08,
  CAD: 0.73,
  INR: 0.012,
  SGD: 0.74,
  AUD: 0.66,
  BRL: 0.2,
};

/** Pay level of each country relative to the US, in USD terms. */
export const countryPayFactor: Record<CountryCode, number> = {
  US: 1,
  GB: 0.72,
  DE: 0.74,
  CA: 0.78,
  AU: 0.8,
  SG: 0.76,
  IN: 0.24,
  BR: 0.3,
};

export interface TitleInfo {
  department: string;
  /** Share of headcount (sums to 100). */
  weight: number;
  /** Typical US annual base salary in USD. */
  usMedianUsd: number;
}

export const titles: Record<string, TitleInfo> = {
  'software-engineer': { department: 'engineering', weight: 24, usMedianUsd: 125_000 },
  'senior-software-engineer': { department: 'engineering', weight: 14, usMedianUsd: 165_000 },
  'engineering-manager': { department: 'engineering', weight: 5, usMedianUsd: 190_000 },
  'product-manager': { department: 'product', weight: 7, usMedianUsd: 150_000 },
  'data-analyst': { department: 'data', weight: 10, usMedianUsd: 92_000 },
  'sales-executive': { department: 'sales', weight: 14, usMedianUsd: 80_000 },
  'hr-generalist': { department: 'people', weight: 6, usMedianUsd: 72_000 },
  'customer-support-specialist': { department: 'support', weight: 20, usMedianUsd: 52_000 },
};

/** Salaries are rounded to a step that looks natural in each currency (in major units). */
export const roundingStep: Record<string, number> = {
  USD: 500,
  GBP: 500,
  EUR: 500,
  CAD: 500,
  AUD: 500,
  SGD: 500,
  BRL: 1_000,
  INR: 10_000,
};

export const terminationReasons = [
  'resignation',
  'resignation',
  'resignation',
  'dismissal',
  'redundancy',
  'retirement',
  'end_of_contract',
  'other',
] as const;

export { names } from './names.js';
