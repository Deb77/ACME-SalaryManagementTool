import type { Employee } from '@acme/shared';
import { csvLine, formatMajor } from '../../lib/csv.js';

const header = [
  'Employee code',
  'First name',
  'Last name',
  'Email',
  'Country',
  'Department',
  'Job title',
  'Hire date',
  'Status',
  'Salary',
  'Currency',
  'Salary effective date',
];

/** The export file (docs/api.md, CSV export). A BOM makes Excel read it as UTF-8. */
export function toEmployeeCsv(
  rows: Employee[],
  minorUnitsOf: (currency: string) => number,
): string {
  const lines = [csvLine(header)];
  for (const e of rows) {
    lines.push(
      csvLine([
        e.employeeCode,
        e.firstName,
        e.lastName,
        e.email,
        e.country,
        e.department.name,
        e.jobTitle.name,
        e.hireDate,
        e.status,
        formatMajor(e.salary.amountMinor, minorUnitsOf(e.salary.currency)),
        e.salary.currency,
        e.salaryEffectiveDate,
      ]),
    );
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
