import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { importFields, type ImportField, type ImportMapping } from '@acme/shared';
import { invalid } from '../../lib/errors.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DATA_ROWS = 10_000;

export interface ParsedSheet {
  format: 'xlsx' | 'csv';
  columns: string[];
  /** Data rows (header excluded), each aligned with `columns`, as trimmed strings. */
  rows: string[][];
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return isoDate(value);
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('text' in value) return String(value.text);
    if ('error' in value) return '';
  }
  return String(value).trim();
}

function normalise(rows: string[][]): Pick<ParsedSheet, 'columns' | 'rows'> {
  const nonEmpty = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
  const [header, ...data] = nonEmpty;
  if (!header) throw invalid('file', 'The file is empty');
  const columns = header.map((c, i) => c.trim() || `Column ${i + 1}`);
  if (new Set(columns).size !== columns.length)
    throw invalid('file', 'Two columns have the same heading');
  if (data.length === 0) throw invalid('file', 'The file has a heading row but no data rows');
  if (data.length > MAX_DATA_ROWS) {
    throw invalid('file', `The file has ${data.length} rows; the limit is ${MAX_DATA_ROWS}`);
  }
  return {
    columns,
    rows: data.map((row) => columns.map((_, i) => (row[i] ?? '').trim())),
  };
}

/** Reads the first worksheet of an .xlsx, or a UTF-8 CSV, into strings. */
export async function parseSpreadsheet(fileName: string, buffer: Buffer): Promise<ParsedSheet> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) {
    let records: string[][];
    try {
      records = parseCsv(buffer, {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true,
      }) as string[][];
    } catch {
      throw invalid('file', 'The CSV could not be read. Save it as UTF-8 CSV and try again.');
    }
    return { format: 'csv', ...normalise(records) };
  }
  if (lower.endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw invalid('file', 'The Excel file could not be read. Save it as .xlsx and try again.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw invalid('file', 'The workbook has no sheets');
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((v) => cellText(v as ExcelJS.CellValue)));
    });
    return { format: 'xlsx', ...normalise(rows) };
  }
  throw invalid('file', 'Upload an .xlsx or .csv file');
}

/** Known header spellings per field, compared after lower-casing and dropping punctuation. */
const aliases: Record<ImportField, string[]> = {
  employeeCode: [
    'employeecode',
    'empid',
    'employeeid',
    'empcode',
    'staffid',
    'code',
    'id',
    'employeeno',
    'empno',
  ],
  firstName: ['firstname', 'name', 'givenname', 'forename', 'first'],
  lastName: ['lastname', 'surname', 'familyname', 'last'],
  email: ['email', 'emailaddress', 'workemail', 'mail'],
  country: ['country', 'countrycode', 'location'],
  jobTitle: ['jobtitle', 'title', 'role', 'position', 'designation', 'job'],
  department: ['department', 'dept', 'team', 'function'],
  hireDate: ['hiredate', 'doj', 'dateofjoining', 'startdate', 'joiningdate', 'joined'],
  salaryAmount: [
    'salary',
    'salaryamount',
    'annualsalary',
    'basesalary',
    'annualctc',
    'ctc',
    'pay',
    'basepay',
  ],
  salaryEffectiveDate: ['salaryeffectivedate', 'effectivedate', 'effectivefrom', 'salarydate'],
};

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Header → field guesses; each column and each field is used at most once. */
export function suggestMapping(columns: readonly string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<string>();
  for (const field of importFields) {
    const exact = columns.find((c) => !used.has(c) && aliases[field].includes(squash(c)));
    const partial =
      exact ??
      columns.find(
        (c) =>
          !used.has(c) &&
          squash(c).length > 3 &&
          aliases[field].some((a) => a.length > 3 && squash(c).includes(a)),
      );
    if (partial) {
      mapping[field] = partial;
      used.add(partial);
    }
  }
  return mapping;
}

/** The downloadable template: headings, one example row and a notes sheet. */
export async function buildTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Employees');
  sheet.columns = [
    { header: 'Employee code', key: 'employeeCode', width: 16 },
    { header: 'First name', key: 'firstName', width: 16 },
    { header: 'Last name', key: 'lastName', width: 16 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Country', key: 'country', width: 10 },
    { header: 'Job title', key: 'jobTitle', width: 26 },
    { header: 'Department', key: 'department', width: 16 },
    { header: 'Hire date', key: 'hireDate', width: 14 },
    { header: 'Salary', key: 'salaryAmount', width: 14 },
    { header: 'Salary effective date', key: 'salaryEffectiveDate', width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    employeeCode: 'ACM-009001',
    firstName: 'Asha',
    lastName: 'Rao',
    email: 'asha.rao@acme.test',
    country: 'IN',
    jobTitle: 'Data Analyst',
    department: 'Data',
    hireDate: '2026-11-02',
    salaryAmount: 1800000,
    salaryEffectiveDate: '2026-11-02',
  });
  const notes = workbook.addWorksheet('Notes');
  notes.addRows([
    ['How to fill this in'],
    ['One row per employee. Leave Employee code empty for a new joiner to get one generated.'],
    [
      'Country is the two-letter code (IN, GB, US, ...). Salary is the annual base pay in that country’s currency, in major units (1800000 = ₹18,00,000).',
    ],
    ['Dates are YYYY-MM-DD. Existing employees are matched by Employee code, then by Email.'],
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
