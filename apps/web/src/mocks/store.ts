/**
 * In-memory data behind the mock API (dev only). Seeded from the story fixtures so the mock
 * and Ladle show the same people and figures. Writes change the lists until the page reloads.
 */
import {
  apiErrorStatus,
  missingRequirements,
  permissionRequires,
  type ApiErrorCode,
  type AuditAction,
  type AuditEvent,
  type Employee,
  type Import,
  type ImportRow,
  type Me,
  type Permission,
  type PermissionInfo,
  type Role,
  type SalaryChange,
  type User,
} from '@acme/shared';
import { employees as syntheticEmployees } from '../stories/sampleData';
import {
  sampleAccessChanges,
  sampleEmployees,
  sampleImportErrors,
  sampleImportUpdates,
  sampleMeta,
  sampleOverview,
  samplePermissions,
  sampleRoles,
  sampleSalaryHistory,
  sampleUsers,
} from '../stories/screenSampleData';

// ---- Errors ----

export class MockApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'MockApiError';
    this.status = apiErrorStatus[code];
  }
}

export const notFound = (what = 'record') =>
  new MockApiError('not_found', `The ${what} was not found`);
export const conflict = (message: string) => new MockApiError('conflict', message);
export const staleVersion = () =>
  new MockApiError('stale_version', 'The record changed since you loaded it');
export const forbidden = (permission?: Permission) =>
  new MockApiError(
    'forbidden',
    'You do not have permission to do this',
    permission ? [{ path: 'permission', message: permission }] : [],
  );
export const validation = (path: string, message: string) =>
  new MockApiError('validation_error', 'The request is invalid', [{ path, message }]);

export function requirePermission(me: Me, permission: Permission) {
  if (!me.permissions.includes(permission)) throw forbidden(permission);
}

// ---- Helpers ----

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let nextId = 5000;
export const newId = () => uuid(nextId++);

export const nowIso = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);

export function currencyFor(country: string) {
  return sampleMeta.countries.find((c) => c.code === country)?.currency ?? 'USD';
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---- Seed: the 10 fixture employees plus the synthetic directory spread over countries ----

const { countries, departments, jobTitles } = sampleMeta;

const titleByName = new Map(jobTitles.map((t) => [t.name, t]));
const departmentByName = new Map(departments.map((d) => [d.name, d]));

/** The last three synthetic people are kept back as the "create" rows of the sample import. */
const RESERVED_FOR_IMPORT = 3;

function syntheticToEmployee(
  entry: (typeof syntheticEmployees)[number],
  index: number,
  seen: Set<string>,
): Employee {
  const [firstName = '', lastName = ''] = entry.name.split(' ');
  const reserved = index >= syntheticEmployees.length - RESERVED_FOR_IMPORT;
  // Names in the synthetic list repeat every 8 rows, so pick the country with a different
  // stride to avoid five identical "Ananya Rao, India" rows in a row.
  const country = reserved
    ? countries[4]!
    : countries[(index * 5 + Math.floor(index / 8)) % countries.length]!;
  const currency = country.currency;
  // Synthetic salaries are INR; rescale by the overview's median pay for the country so the
  // amounts look like local pay (the same rule insights.ts uses).
  const india = sampleOverview.countries.find((c) => c.country === 'IN')!;
  const local = sampleOverview.countries.find((c) => c.country === country.code) ?? india;
  const factor = local.medianMinor / india.medianMinor;
  const amountMinor = Math.max(1, Math.round((entry.salaryMinor * factor) / 10_000) * 10_000);
  let email = `${firstName}.${lastName}@${country.code.toLowerCase()}.acme.com`.toLowerCase();
  if (seen.has(email)) email = email.replace('@', `.${index + 42}@`);
  seen.add(email);
  const hireDate = `${2017 + (index % 8)}-${String(1 + (index % 12)).padStart(2, '0')}-${String(
    1 + ((index * 7) % 28),
  ).padStart(2, '0')}`;
  const terminated = entry.status === 'terminated';
  return {
    id: uuid(200 + index),
    // The synthetic codes start at ACME-00042, which the fixture directory already uses.
    employeeCode: `ACME-${String(2000 + index + 42).padStart(5, '0')}`,
    firstName,
    lastName,
    email,
    country: country.code,
    jobTitle: titleByName.get(entry.title) ?? jobTitles[3]!,
    department: departmentByName.get(entry.department) ?? departments[0]!,
    hireDate,
    status: terminated ? 'terminated' : 'active',
    termination: terminated
      ? { date: '2026-09-30', reason: index % 2 ? 'resignation' : 'end_of_contract', note: null }
      : null,
    salary: { amountMinor, currency },
    salaryEffectiveDate: '2026-04-01',
    version: 1 + (index % 3),
    createdAt: `${hireDate}T09:00:00.000Z`,
    updatedAt: '2026-04-01T09:30:00.000Z',
  };
}

const fixtureEmails = new Set(sampleEmployees.map((e) => e.email));
const allSynthetic = syntheticEmployees.map((entry, index) =>
  syntheticToEmployee(entry, index, fixtureEmails),
);
const seededSynthetic = allSynthetic.slice(0, allSynthetic.length - RESERVED_FOR_IMPORT);
/** New joiners the sample import would create (see `importCreateRows`). */
export const importJoiners = allSynthetic.slice(allSynthetic.length - RESERVED_FOR_IMPORT);

const seedActor = { id: uuid(1), name: 'Riya Kapoor' };

function hireEntry(employee: Employee): SalaryChange {
  return {
    id: newId(),
    employeeId: employee.id,
    amount: employee.salary,
    previousAmount: null,
    effectiveDate: employee.hireDate,
    reason: 'hire',
    note: null,
    importId: null,
    aiDraftId: null,
    createdAt: employee.createdAt,
    createdBy: seedActor,
  };
}

// ---- State ----

export interface ImportRecord extends Import {
  rows: ImportRow[];
  /** What commit changed, so undo can compensate. */
  applied: { createdIds: string[]; salaryReverts: { employeeId: string; entry: SalaryChange }[] };
}

export interface Store {
  employees: Map<string, Employee>;
  salaryChanges: Map<string, SalaryChange[]>;
  users: Map<string, User>;
  roles: Map<string, Role>;
  permissions: PermissionInfo[];
  audit: AuditEvent[];
  imports: Map<string, ImportRecord>;
  nextEmployeeNumber: number;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createStore(): Store {
  const employees = new Map<string, Employee>();
  const salaryChanges = new Map<string, SalaryChange[]>();
  for (const employee of [...sampleEmployees, ...seededSynthetic]) {
    employees.set(employee.id, clone(employee));
    salaryChanges.set(employee.id, [hireEntry(employee)]);
  }
  // Priya's full history from the fixture (newest first).
  const priya = sampleEmployees[0]!;
  salaryChanges.set(priya.id, clone(sampleSalaryHistory));

  return {
    employees,
    salaryChanges,
    users: new Map(sampleUsers.map((user) => [user.id, clone(user)])),
    roles: new Map(sampleRoles.map((role) => [role.id, clone(role)])),
    permissions: samplePermissions.map((p) => ({ ...p, requires: [...permissionRequires[p.key]] })),
    audit: clone(sampleAccessChanges),
    imports: new Map(),
    nextEmployeeNumber: 1001,
  };
}

export let store: Store = createStore();

export function resetStore() {
  store = createStore();
  nextId = 5000;
}

// ---- Audit ----

export function recordAudit(
  me: Me,
  action: AuditAction,
  entity: AuditEvent['entity'],
  change: {
    country?: string | null;
    before?: AuditEvent['before'];
    after?: AuditEvent['after'];
  } = {},
  context: AuditEvent['context'] = null,
) {
  store.audit.unshift({
    id: newId(),
    occurredAt: nowIso(),
    actor: { id: me.id, name: me.name, role: me.role.key },
    action,
    entity,
    country: change.country ?? null,
    before: change.before ?? null,
    after: change.after ?? null,
    context,
  });
}

// ---- Employees ----

export const employeeLabel = (e: Employee) => `${e.employeeCode} ${e.firstName} ${e.lastName}`;

export function visibleEmployees(me: Me): Employee[] {
  return [...store.employees.values()].filter((e) => me.countries.includes(e.country));
}

/** Out of scope reads as 404, never 403 (docs/api.md, "Out of scope = 404"). */
export function getVisibleEmployee(me: Me, id: string): Employee {
  const employee = store.employees.get(id);
  if (!employee || !me.countries.includes(employee.country)) throw notFound('employee');
  return employee;
}

export function assertVersion(expected: number, actual: number) {
  if (expected !== actual) throw staleVersion();
}

export function assertUniqueEmployee(email: string, code: string | undefined, exceptId?: string) {
  for (const other of store.employees.values()) {
    if (other.id === exceptId) continue;
    if (other.email.toLowerCase() === email.toLowerCase()) {
      throw conflict(`An employee with the email ${email} already exists`);
    }
    if (code && other.employeeCode === code) {
      throw conflict(`An employee with the code ${code} already exists`);
    }
  }
}

export function nextEmployeeCode() {
  for (;;) {
    const code = `ACME-${String(store.nextEmployeeNumber++).padStart(5, '0')}`;
    if (![...store.employees.values()].some((e) => e.employeeCode === code)) return code;
  }
}

export function touch(employee: Employee) {
  employee.version += 1;
  employee.updatedAt = nowIso();
}

export function latestSalaryChange(employeeId: string): SalaryChange | undefined {
  return store.salaryChanges.get(employeeId)?.[0];
}

/** The one code path that writes pay, like `SalaryService.change()` in the real API. */
export function applySalaryChange(
  me: Me,
  employee: Employee,
  input: {
    amountMinor: number;
    effectiveDate: string;
    reason: SalaryChange['reason'];
    note?: string | null;
    importId?: string | null;
    aiDraftId?: string | null;
  },
): SalaryChange {
  const entry: SalaryChange = {
    id: newId(),
    employeeId: employee.id,
    amount: { amountMinor: input.amountMinor, currency: employee.salary.currency },
    previousAmount: { ...employee.salary },
    effectiveDate: input.effectiveDate,
    reason: input.reason,
    note: input.note ?? null,
    importId: input.importId ?? null,
    aiDraftId: input.aiDraftId ?? null,
    createdAt: nowIso(),
    createdBy: { id: me.id, name: me.name },
  };
  const history = store.salaryChanges.get(employee.id) ?? [];
  history.unshift(entry);
  store.salaryChanges.set(employee.id, history);
  recordAudit(
    me,
    'salary.changed',
    { type: 'employee', id: employee.id, label: employeeLabel(employee) },
    {
      country: employee.country,
      before: { salaryAmountMinor: employee.salary.amountMinor },
      after: { salaryAmountMinor: input.amountMinor, reason: input.reason },
    },
    { importId: input.importId ?? null, aiDraftId: input.aiDraftId ?? null },
  );
  employee.salary = entry.amount;
  employee.salaryEffectiveDate = input.effectiveDate;
  touch(employee);
  return entry;
}

// ---- Access ----

export function roleRef(role: Role) {
  return { id: role.id, key: role.key, name: role.name };
}

export function findRole(id: string): Role {
  const role = store.roles.get(id);
  if (!role) throw notFound('role');
  return role;
}

export function findUser(id: string): User {
  const user = store.users.get(id);
  if (!user) throw notFound('user');
  return user;
}

export function assertHoldsPermissions(me: Me, permissions: readonly Permission[]) {
  const missing = permissions.filter((p) => !me.permissions.includes(p));
  if (missing.length > 0) {
    throw new MockApiError(
      'forbidden',
      'You can only grant permissions you hold yourself',
      missing.map((p) => ({ path: 'permissions', message: p })),
    );
  }
}

export function assertRequirements(permissions: readonly Permission[]) {
  const missing = missingRequirements(permissions);
  if (missing.length > 0) {
    throw new MockApiError(
      'validation_error',
      'Some permissions need others that are not granted',
      missing.map((m) => ({
        path: 'permissions',
        message: `${m.permission} requires ${m.requires}`,
      })),
    );
  }
}

export function activeGlobalHrCount() {
  return [...store.users.values()].filter(
    (u) => u.status === 'active' && u.role.key === 'global_hr',
  ).length;
}

export function uniqueRoleKey(name: string) {
  const base = slug(name) || 'role';
  let key = base;
  for (let n = 2; [...store.roles.values()].some((r) => r.key === key); n++) key = `${base}-${n}`;
  return key;
}

// ---- Imports ----

export function findImport(id: string): ImportRecord {
  const record = store.imports.get(id);
  if (!record) throw notFound('import');
  return record;
}

/** Row preview for the dry run: the fixture errors and updates, plus the reserved joiners. */
export function buildImportRows(): ImportRow[] {
  const creates: ImportRow[] = importJoiners.map((joiner, index) => ({
    rowNumber: 20 + index * 7,
    outcome: 'create',
    employeeCode: joiner.employeeCode,
    changes: {
      firstName: { from: null, to: joiner.firstName },
      lastName: { from: null, to: joiner.lastName },
      email: { from: null, to: joiner.email },
      jobTitleId: { from: null, to: joiner.jobTitle.id },
      departmentId: { from: null, to: joiner.department.id },
      hireDate: { from: null, to: joiner.hireDate },
      salaryAmountMinor: { from: null, to: joiner.salary.amountMinor },
    },
    errors: [],
  }));
  return [
    ...structuredClone(sampleImportErrors),
    ...structuredClone(sampleImportUpdates),
    ...creates,
  ];
}

export function findEmployeeByCode(code: string | null) {
  if (!code) return undefined;
  return [...store.employees.values()].find((e) => e.employeeCode === code);
}
