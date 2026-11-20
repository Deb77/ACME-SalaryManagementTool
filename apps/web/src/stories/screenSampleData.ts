/**
 * Synthetic data for the screen stories and screen view tests, in the exact `@acme/shared`
 * shapes the API returns. Names and figures follow the design canvas sample data
 * (Priya Sharma, ₹32,40,000, Data Analysts in India vs the US and UK, …).
 * Amounts are minor units.
 */
import type {
  Employee,
  ImportRow,
  ImportUploadResponse,
  InsightsByTitle,
  InsightsOverview,
  Me,
  Meta,
  PermissionInfo,
  Role,
  SalaryChange,
  SalaryChangeDraft,
  SalaryDistribution,
  TitleComparison,
  User,
} from '@acme/shared';
import { permissionKeys } from '@acme/shared';
import type { AuditEvent } from '@acme/shared';
import { permissionLabels } from '../lib/format';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const lakh = (value: number) => Math.round(value * 100_000 * 100);

export const sampleMeta: Meta = {
  countries: [
    { code: 'US', name: 'United States', currency: 'USD', minorUnits: 2 },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', minorUnits: 2 },
    { code: 'DE', name: 'Germany', currency: 'EUR', minorUnits: 2 },
    { code: 'CA', name: 'Canada', currency: 'CAD', minorUnits: 2 },
    { code: 'IN', name: 'India', currency: 'INR', minorUnits: 2 },
    { code: 'SG', name: 'Singapore', currency: 'SGD', minorUnits: 2 },
    { code: 'AU', name: 'Australia', currency: 'AUD', minorUnits: 2 },
    { code: 'BR', name: 'Brazil', currency: 'BRL', minorUnits: 2 },
  ],
  departments: [
    { id: 'engineering', name: 'Engineering' },
    { id: 'product', name: 'Product' },
    { id: 'data', name: 'Data' },
    { id: 'support', name: 'Support' },
    { id: 'sales', name: 'Sales' },
    { id: 'people', name: 'People' },
  ],
  jobTitles: [
    { id: 'engineering-manager', name: 'Engineering Manager' },
    { id: 'product-manager', name: 'Product Manager' },
    { id: 'senior-software-engineer', name: 'Senior Software Engineer' },
    { id: 'software-engineer', name: 'Software Engineer' },
    { id: 'data-analyst', name: 'Data Analyst' },
    { id: 'sales-executive', name: 'Sales Executive' },
    { id: 'hr-generalist', name: 'HR Generalist' },
    { id: 'customer-support-specialist', name: 'Customer Support Specialist' },
  ],
  salaryChangeReasons: ['annual_review', 'promotion', 'market_adjustment', 'correction', 'other'],
  terminationReasons: [
    'resignation',
    'dismissal',
    'redundancy',
    'retirement',
    'end_of_contract',
    'other',
  ],
  fx: {
    ratesAsOf: '2026-11-01',
    rates: { USD: 1, GBP: 1.27, EUR: 1.08, CAD: 0.73, INR: 0.012, SGD: 0.74, AUD: 0.66, BRL: 0.2 },
  },
};

const ref = (list: Meta['jobTitles'], id: string) => list.find((item) => item.id === id)!;

const directory: [string, string, string, string, number][] = [
  ['ACME-00042', 'Priya Sharma', 'senior-software-engineer', 'engineering', 32.4],
  ['ACME-00107', 'Arjun Mehta', 'software-engineer', 'engineering', 16.8],
  ['ACME-00213', 'Kavya Iyer', 'product-manager', 'product', 36.5],
  ['ACME-00388', 'Rohan Gupta', 'data-analyst', 'data', 11.2],
  ['ACME-00451', 'Ananya Reddy', 'customer-support-specialist', 'support', 4.8],
  ['ACME-00529', 'Vikram Nair', 'engineering-manager', 'engineering', 54],
  ['ACME-00614', 'Sneha Kulkarni', 'sales-executive', 'sales', 8.6],
  ['ACME-00782', 'Aditya Joshi', 'hr-generalist', 'people', 9.1],
  ['ACME-00835', 'Meera Pillai', 'software-engineer', 'engineering', 21.3],
  ['ACME-00916', 'Karan Malhotra', 'sales-executive', 'sales', 12.4],
];

export const sampleEmployees: Employee[] = directory.map(
  ([code, name, title, department, salary], index) => {
    const [firstName = '', lastName = ''] = name.split(' ');
    return {
      id: uuid(100 + index),
      employeeCode: code,
      firstName,
      lastName,
      email: `${firstName}.${lastName}@acme.com`.toLowerCase(),
      country: 'IN',
      jobTitle: ref(sampleMeta.jobTitles, title),
      department: ref(sampleMeta.departments, department),
      hireDate: '2021-06-14',
      status: 'active',
      termination: null,
      salary: { amountMinor: lakh(salary), currency: 'INR' },
      salaryEffectiveDate: '2026-04-01',
      version: 3,
      createdAt: '2021-06-14T09:30:00.000Z',
      updatedAt: '2026-04-01T09:30:00.000Z',
    };
  },
);

export const samplePriya: Employee = sampleEmployees[0]!;

const riya = { id: uuid(1), name: 'Riya Kapoor' };

export const sampleSalaryHistory: SalaryChange[] = [
  ['2026-04-01', 'annual_review', 30, 32.4, 'Annual review FY26'],
  ['2024-10-01', 'promotion', 25, 30, 'Promoted to senior'],
  ['2023-04-01', 'annual_review', 23, 25, 'Annual review FY23'],
  ['2021-06-14', 'hire', null, 23, 'Offer accepted'],
].map(([date, reason, previous, next, note], index) => ({
  id: uuid(300 + index),
  employeeId: samplePriya.id,
  amount: { amountMinor: lakh(next as number), currency: 'INR' },
  previousAmount:
    previous === null ? null : { amountMinor: lakh(previous as number), currency: 'INR' },
  effectiveDate: date as string,
  reason: reason as SalaryChange['reason'],
  note: note as string,
  importId: null,
  aiDraftId: null,
  createdAt: `${date as string}T09:00:00.000Z`,
  createdBy: riya,
}));

export const sampleTitleComparison: TitleComparison = {
  jobTitle: ref(sampleMeta.jobTitles, 'senior-software-engineer'),
  rows: [
    {
      country: 'IN',
      currency: 'INR',
      headcount: 288,
      minMinor: lakh(22),
      medianMinor: lakh(31.5),
      avgMinor: lakh(32.8),
      maxMinor: lakh(48),
      medianUsdIndicativeMinor: 3_780_000,
    },
  ],
};

const countryStats: [string, string, number, number, number, number, number, number][] = [
  // code, currency, headcount, min, median, avg, max (major units), payroll USD (millions)
  ['US', 'USD', 2980, 52_000, 118_000, 126_400, 410_000, 376.7],
  ['GB', 'GBP', 1240, 26_000, 62_000, 66_900, 210_000, 104.8],
  ['DE', 'EUR', 980, 34_000, 68_500, 72_700, 190_000, 77.0],
  ['CA', 'CAD', 720, 45_000, 92_000, 96_900, 240_000, 50.9],
  ['IN', 'INR', 2412, 360_000, 1_320_000, 1_605_000, 7_200_000, 46.1],
  ['SG', 'SGD', 510, 38_000, 96_000, 105_200, 260_000, 39.7],
  ['AU', 'AUD', 278, 62_000, 118_000, 123_100, 280_000, 22.6],
  ['BR', 'BRL', 380, 48_000, 168_000, 163_200, 520_000, 12.4],
];

export const sampleOverview: InsightsOverview = {
  countries: countryStats.map(([country, currency, headcount, min, median, avg, max, usd]) => ({
    country,
    currency,
    headcount,
    minMinor: min * 100,
    medianMinor: median * 100,
    avgMinor: avg * 100,
    maxMinor: max * 100,
    payrollMinor: Math.round(avg * headcount) * 100,
    payrollUsdIndicativeMinor: Math.round(usd * 1_000_000 * 100),
  })),
  total: { headcount: 9500, payrollUsdIndicativeMinor: 73_020_000_000 },
  fx: { indicative: true, ratesAsOf: '2026-11-01', base: 'USD' },
};

export const sampleByTitle: InsightsByTitle = {
  country: 'IN',
  currency: 'INR',
  rows: (
    [
      ['engineering-manager', 74, 38, 52, 72],
      ['product-manager', 96, 20, 33, 55],
      ['senior-software-engineer', 288, 22, 31.5, 48],
      ['software-engineer', 612, 9.5, 18.4, 34],
      ['data-analyst', 158, 7.2, 12.6, 21],
      ['sales-executive', 236, 5, 9.8, 18],
      ['hr-generalist', 64, 5.5, 8.9, 14],
      ['customer-support-specialist', 402, 3.6, 5.4, 9],
    ] as const
  ).map(([id, headcount, min, median, max]) => ({
    jobTitle: ref(sampleMeta.jobTitles, id),
    headcount,
    minMinor: lakh(min),
    medianMinor: lakh(median),
    avgMinor: lakh((min + max) / 2),
    maxMinor: lakh(max),
    payrollMinor: lakh(median) * headcount,
  })),
};

export const sampleDistribution: SalaryDistribution = {
  currency: 'INR',
  buckets: [210, 640, 520, 410, 230, 130, 110, 60, 102].map((count, index) => ({
    fromMinor: lakh(index * 5),
    toMinor: lakh(index * 5 + 5),
    count,
  })),
};

export const sampleDraft: SalaryChangeDraft = {
  draftId: uuid(900),
  employeeId: sampleEmployees[3]!.id,
  employeeName: 'Rohan Gupta',
  currentAmount: { amountMinor: lakh(8.2), currency: 'INR' },
  proposedAmount: { amountMinor: lakh(9.5), currency: 'INR' },
  effectiveDate: '2026-12-01',
  reason: 'market_adjustment',
  note: 'Bottom 10% for Data Analysts in India, over 3 years at ACME',
};

// ---- Access & roles ----

export const sampleRoles: Role[] = [
  {
    id: uuid(501),
    key: 'global_hr',
    name: 'Global HR',
    description: 'Full access in every country',
    countryScope: 'all',
    isSystem: true,
    permissions: [...permissionKeys],
    userCount: 2,
    version: 1,
  },
  {
    id: uuid(502),
    key: 'country_hr',
    name: 'Country HR',
    description: 'HR for the countries assigned to them',
    countryScope: 'assigned',
    isSystem: true,
    permissions: permissionKeys.filter((key) => key !== 'users:manage' && key !== 'roles:manage'),
    userCount: 6,
    version: 3,
  },
  {
    id: uuid(503),
    key: 'finance_viewer',
    name: 'Finance viewer',
    description: 'Read-only pay data for finance',
    countryScope: 'all',
    isSystem: false,
    permissions: ['employees:read', 'insights:read'],
    userCount: 0,
    version: 1,
  },
];

export const samplePermissions: PermissionInfo[] = permissionKeys.map((key) => ({
  key,
  description: permissionLabels[key],
  requires: [],
}));

const roleRef = (role: Role) => ({ id: role.id, key: role.key, name: role.name });
const [globalRole, countryRole] = sampleRoles as [Role, Role, Role];

export const sampleUsers: User[] = (
  [
    ['Riya Kapoor', globalRole, [], 'active', '2026-11-20T11:58:00.000Z'],
    ['Daniel Brooks', globalRole, [], 'active', '2026-11-20T10:00:00.000Z'],
    ['Ananya Rao', countryRole, ['IN'], 'active', '2026-11-20T11:50:00.000Z'],
    ['Sarah Mitchell', countryRole, ['US', 'CA'], 'active', '2026-11-19T12:00:00.000Z'],
    ['Oliver Grant', countryRole, ['GB'], 'active', '2026-11-17T12:00:00.000Z'],
    ['Lena Fischer', countryRole, ['DE'], 'active', '2026-11-20T08:00:00.000Z'],
    ['Wei Ling Tan', countryRole, ['SG', 'AU'], 'invited', null],
    ['Lucas Pereira', countryRole, ['BR'], 'active', '2026-11-13T12:00:00.000Z'],
  ] as const
).map(([name, role, countries, status, lastSignInAt], index) => ({
  id: uuid(1 + index),
  name,
  email: `${name.toLowerCase().replace(' ', '.').replace(' ', '')}@acme.com`,
  role: roleRef(role),
  countries: [...countries],
  status,
  lastSignInAt,
  version: 1,
}));

export const sampleMeGlobal: Me = {
  id: uuid(1),
  email: 'riya.kapoor@acme.com',
  name: 'Riya Kapoor',
  role: { ...roleRef(globalRole), countryScope: 'all' },
  permissions: [...permissionKeys],
  countries: sampleMeta.countries.map((country) => country.code),
};

export const sampleMeCountry: Me = {
  id: uuid(3),
  email: 'ananya.rao@acme.com',
  name: 'Ananya Rao',
  role: { ...roleRef(countryRole), countryScope: 'assigned' },
  permissions: countryRole.permissions,
  countries: ['IN'],
};

/** A read-only role: no writes, exports, imports or access management. */
export const sampleMeViewer: Me = {
  id: uuid(20),
  email: 'finance@acme.com',
  name: 'Maya Finance',
  role: { id: uuid(503), key: 'finance_viewer', name: 'Finance viewer', countryScope: 'all' },
  permissions: ['employees:read', 'insights:read'],
  countries: sampleMeGlobal.countries,
};

export const sampleAccessChanges: AuditEvent[] = (
  [
    ['Riya Kapoor', 'user.updated', 'Sarah Mitchell', '2026-11-19T12:00:00.000Z'],
    ['Daniel Brooks', 'user.invited', 'Wei Ling Tan', '2026-11-18T12:00:00.000Z'],
    ['Riya Kapoor', 'user.updated', 'Ananya Rao', '2026-11-12T12:00:00.000Z'],
  ] as const
).map(([actor, action, label, occurredAt], index) => ({
  id: uuid(700 + index),
  occurredAt,
  actor: { id: uuid(1), name: actor, role: 'global_hr' },
  action,
  entity: { type: 'user', id: uuid(4 + index), label },
  country: null,
  before: null,
  after: null,
  context: null,
}));

// ---- Import ----

export const sampleUpload: ImportUploadResponse = {
  id: uuid(800),
  status: 'uploaded',
  fileName: 'india_salaries_nov2026.xlsx',
  columns: ['Emp ID', 'Name', 'Surname', 'E-mail', 'Role', 'Dept', 'Annual CTC', 'DOJ'],
  sampleRows: [
    ['ACME-00042', 'Priya', 'Sharma', 'priya.sharma@acme.com', 'Senior Software Engineer'],
  ],
  suggestedMapping: {
    employeeCode: 'Emp ID',
    firstName: 'Name',
    lastName: 'Surname',
    email: 'E-mail',
    jobTitle: 'Role',
    department: 'Dept',
    salaryAmount: 'Annual CTC',
    hireDate: 'DOJ',
  },
};

export const sampleImportSummary = {
  rows: 2431,
  create: 18,
  update: 41,
  unchanged: 2353,
  error: 19,
};

export const sampleImportErrors: ImportRow[] = (
  [
    [14, 'ACME-01233', 'Role', "Job title isn't in ACME's catalogue (“Sr. Data Analyst”)."],
    [92, null, 'E-mail', 'Work email is required for new employees.'],
    [311, 'ACME-02018', 'Annual CTC', 'Not a number (“1,20,00,000 INR”).'],
    [
      640,
      'ACME-00377',
      'Country',
      'US is outside your countries. Ask Global HR to make this change.',
    ],
    [1022, null, 'E-mail', 'Same email as row 1088.'],
    [1500, 'ACME-03310', 'DOJ', 'Not a real date (31/02/2022).'],
  ] as const
).map(([rowNumber, employeeCode, column, message]) => ({
  rowNumber,
  outcome: 'error',
  employeeCode,
  changes: {},
  errors: [{ column, message }],
}));

export const sampleImportUpdates: ImportRow[] = [
  {
    rowNumber: 3,
    outcome: 'update',
    employeeCode: 'ACME-00042',
    changes: { salaryAmountMinor: { from: lakh(32.4), to: lakh(35) } },
    errors: [],
  },
  {
    rowNumber: 8,
    outcome: 'update',
    employeeCode: 'ACME-00388',
    changes: { jobTitleId: { from: 'data-analyst', to: 'senior-data-analyst' } },
    errors: [],
  },
];
