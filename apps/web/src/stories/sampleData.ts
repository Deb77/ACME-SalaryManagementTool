import type { HistogramBin, NavGroup, QueryStep, TrendPoint } from '../components';

/** Synthetic data for Ladle stories only. Amounts are minor units. */

export const navGroups: NavGroup[] = [
  { label: 'People', items: [{ key: 'employees', label: 'Employees', href: '#' }] },
  {
    label: 'Analytics',
    items: [
      { key: 'insights', label: 'Insights', href: '#' },
      { key: 'ask', label: 'Ask AI', href: '#' },
    ],
  },
  { label: 'Admin', items: [{ key: 'roles', label: 'Access & roles', href: '#' }] },
];

export interface SampleEmployee {
  id: string;
  name: string;
  code: string;
  email: string;
  title: string;
  department: string;
  salaryMinor: number;
  currency: string;
  status: 'active' | 'terminated';
}

const firstNames = ['Priya', 'Arjun', 'Neha', 'Rahul', 'Ananya', 'Vikram', 'Sara', 'Tom'];
const lastNames = ['Sharma', 'Mehta', 'Bansal', 'Iyer', 'Rao', 'Singh', 'Khan', 'Patel'];
const titles = ['Senior Software Engineer', 'Data Analyst', 'Product Manager', 'Sales Executive'];

export const employees: SampleEmployee[] = Array.from({ length: 42 }, (_, index) => {
  const first = firstNames[index % firstNames.length]!;
  const last = lastNames[(index * 3) % lastNames.length]!;
  const code = `ACME-${String(index + 42).padStart(5, '0')}`;
  return {
    id: code,
    name: `${first} ${last}`,
    code,
    email: `${first}.${last}@acme.com`.toLowerCase(),
    title: titles[index % titles.length]!,
    department: index % 2 === 0 ? 'Engineering' : 'Data',
    salaryMinor: (900_000 + ((index * 137_000) % 3_000_000)) * 100,
    currency: 'INR',
    status: index % 9 === 4 ? 'terminated' : 'active',
  };
});

export const payrollTrend: TrendPoint[] = [
  ['Dec', 57.9],
  ['Jan', 58.0],
  ['Feb', 58.1],
  ['Mar', 58.3],
  ['Apr', 59.6],
  ['May', 59.7],
  ['Jun', 59.9],
  ['Jul', 60.1],
  ['Aug', 60.2],
  ['Sep', 60.4],
  ['Oct', 60.7],
  ['Nov', 60.9],
].map(([label, value]) => ({ label: String(label), value: Number(value) }));

export const salaryBins: HistogramBin[] = [
  ['0–5', 210],
  ['5–10', 640],
  ['10–15', 520],
  ['15–20', 410],
  ['20–25', 230],
  ['25–30', 130],
  ['30–35', 110],
  ['35–40', 60],
  ['40+', 102],
].map(([label, count]) => ({ label: String(label), count: Number(count) }));

export const payByTitle = [
  { title: 'Engineering Manager', min: 38, median: 52, max: 72 },
  { title: 'Senior Software Engineer', min: 22, median: 31.5, max: 48 },
  { title: 'Data Analyst', min: 7.2, median: 12.6, max: 21 },
  { title: 'Customer Support', min: 3.6, median: 5.4, max: 9 },
];

export const querySteps: QueryStep[] = [
  {
    label: 'Looked up Data Analyst pay in India, US and UK',
    query: 'salary_stats(title="Data Analyst", countries=["IN","US","GB"])',
    result: '3 rows',
  },
  {
    label: 'Found analysts in the bottom 10% for India',
    query: 'list_employees(title="Data Analyst", country="IN", max_salary=850000)',
    result: '9 people',
  },
  {
    label: 'Checked their tenure',
    query: 'tenure_years(employee_ids=[…9])',
    result: '7 over 3 years',
  },
];
