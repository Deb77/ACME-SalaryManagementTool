/**
 * MSW handlers for every call in `src/api/endpoints.ts` and `askStream.ts`, following
 * docs/api.md: the same error envelope, offset pagination for employees, cursor pagination
 * for audit, and the SSE stream for Ask AI. Dev and tests only; never shipped.
 */
import {
  commitImportRequestSchema,
  createEmployeeRequestSchema,
  createRoleRequestSchema,
  createSalaryChangeRequestSchema,
  importMappingRequestSchema,
  inviteUserRequestSchema,
  listEmployeesQuerySchema,
  terminateEmployeeRequestSchema,
  updateEmployeeRequestSchema,
  updateRoleRequestSchema,
  updateUserRequestSchema,
  validationErrorBody,
  type AiStreamEvent,
  type ApiErrorBody,
  type AuditEvent,
  type Employee,
  type Me,
  type Role,
  type User,
} from '@acme/shared';
import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw';
import type { z } from 'zod';
import { sampleImportSummary, sampleMeta, sampleUpload } from '../stories/screenSampleData';
import { firstTurnEvents, followUpEvents } from './askTranscript';
import { mockConfig } from './config';
import * as insights from './insights';
import { currentMe } from './mockUser';
import {
  activeGlobalHrCount,
  applySalaryChange,
  assertHoldsPermissions,
  assertRequirements,
  assertUniqueEmployee,
  assertVersion,
  buildImportRows,
  conflict,
  currencyFor,
  employeeLabel,
  findEmployeeByCode,
  findImport,
  findRole,
  findUser,
  forbidden,
  getVisibleEmployee,
  importJoiners,
  latestSalaryChange,
  MockApiError,
  newId,
  nextEmployeeCode,
  notFound,
  nowIso,
  recordAudit,
  requirePermission,
  roleRef,
  store,
  today,
  touch,
  uniqueRoleKey,
  validation,
  visibleEmployees,
} from './store';

const api = (path: string) => `/api${path}`;

// ---- Plumbing ----

function errorResponse(error: MockApiError) {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, details: error.details },
  };
  return HttpResponse.json(body, { status: error.status });
}

/** Runs a resolver with the current user, turning thrown `MockApiError`s into the envelope. */
function handle(
  resolver: (me: Me, info: Parameters<HttpResponseResolver>[0]) => Response | Promise<Response>,
): HttpResponseResolver {
  return async (info) => {
    if (mockConfig.latencyMs > 0) await delay(mockConfig.latencyMs);
    try {
      return await resolver(currentMe(), info);
    } catch (error) {
      if (error instanceof MockApiError) return errorResponse(error);
      throw error;
    }
  };
}

async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const json = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const body = validationErrorBody(parsed.error);
    throw new MockApiError('validation_error', body.error.message, body.error.details ?? []);
  }
  return parsed.data;
}

const param = (info: Parameters<HttpResponseResolver>[0], name: string) =>
  String(info.params[name] ?? '');

const json = (body: unknown, init?: ResponseInit) =>
  HttpResponse.json(body as Parameters<typeof HttpResponse.json>[0], init);

const csvCell = (value: string | number) => {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const csv = (rows: (string | number)[][], filename: string) =>
  new HttpResponse(rows.map((row) => row.map(csvCell).join(',')).join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });

// ---- Employees: filters, sort, pagination ----

function parseListQuery(url: URL) {
  const raw: Record<string, string | string[] | undefined> = {};
  for (const key of ['q', 'status', 'sort', 'page', 'pageSize']) {
    const value = url.searchParams.get(key);
    if (value !== null) raw[key] = value;
  }
  for (const key of ['country', 'department', 'jobTitle']) {
    const values = url.searchParams.getAll(key);
    if (values.length > 0) raw[key] = values;
  }
  const parsed = listEmployeesQuerySchema.safeParse(raw);
  if (!parsed.success) {
    const body = validationErrorBody(parsed.error);
    throw new MockApiError('validation_error', body.error.message, body.error.details ?? []);
  }
  return parsed.data;
}

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

const sortKey: Record<string, (e: Employee) => string | number> = {
  name: fullName,
  employeeCode: (e) => e.employeeCode,
  country: (e) => e.country,
  jobTitle: (e) => e.jobTitle.name,
  department: (e) => e.department.name,
  hireDate: (e) => e.hireDate,
  salary: (e) => e.salary.amountMinor,
};

export function filterEmployees(me: Me, url: URL) {
  const query = parseListQuery(url);
  const q = query.q?.toLowerCase();
  const rows = visibleEmployees(me).filter((e) => {
    if (query.status !== 'all' && e.status !== query.status) return false;
    if (query.country && !query.country.includes(e.country)) return false;
    if (query.department && !query.department.includes(e.department.id)) return false;
    if (query.jobTitle && !query.jobTitle.includes(e.jobTitle.id)) return false;
    if (
      q &&
      !fullName(e).toLowerCase().includes(q) &&
      !e.email.toLowerCase().includes(q) &&
      !e.employeeCode.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });
  const key = sortKey[query.sort.field] ?? fullName;
  const direction = query.sort.direction === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    const cmp =
      typeof ka === 'number' && typeof kb === 'number'
        ? ka - kb
        : String(ka).localeCompare(String(kb), 'en');
    return cmp !== 0 ? cmp * direction : a.id.localeCompare(b.id);
  });
  return { rows, query };
}

// ---- Handlers ----

export const handlers = [
  http.get(api('/health'), () => json({ status: 'ok' })),

  http.get(
    api('/auth/me'),
    handle((me) => json(me)),
  ),

  http.get(
    api('/meta'),
    handle(() => json(sampleMeta, { headers: { ETag: '"mock-meta-1"' } })),
  ),

  // -- Employees --

  http.get(
    api('/employees'),
    handle((me, { request }) => {
      requirePermission(me, 'employees:read');
      const { rows, query } = filterEmployees(me, new URL(request.url));
      const start = (query.page - 1) * query.pageSize;
      return json({
        items: rows.slice(start, start + query.pageSize),
        page: query.page,
        pageSize: query.pageSize,
        total: rows.length,
      });
    }),
  ),

  http.get(
    api('/employees/export.csv'),
    handle((me, { request }) => {
      requirePermission(me, 'employees:export');
      const url = new URL(request.url);
      url.searchParams.delete('page');
      url.searchParams.delete('pageSize');
      const { rows } = filterEmployees(me, url);
      recordAudit(
        me,
        'export.created',
        { type: 'export', id: newId(), label: 'employees.csv' },
        {},
        {
          filters: Object.fromEntries(url.searchParams),
        },
      );
      const minor = (e: Employee) =>
        (e.salary.amountMinor / 100).toFixed(
          sampleMeta.countries.find((c) => c.code === e.country)?.minorUnits ?? 2,
        );
      return csv(
        [
          [
            'code',
            'first name',
            'last name',
            'email',
            'country',
            'department',
            'job title',
            'hire date',
            'status',
            'salary',
            'currency',
            'salary effective date',
          ],
          ...rows.map((e) => [
            e.employeeCode,
            e.firstName,
            e.lastName,
            e.email,
            e.country,
            e.department.name,
            e.jobTitle.name,
            e.hireDate,
            e.status,
            minor(e),
            e.salary.currency,
            e.salaryEffectiveDate,
          ]),
        ],
        `employees-${today()}.csv`,
      );
    }),
  ),

  http.post(
    api('/employees'),
    handle(async (me, { request }) => {
      requirePermission(me, 'employees:write');
      const body = await parseBody(request, createEmployeeRequestSchema);
      if (!me.countries.includes(body.country)) throw forbidden('employees:write');
      const jobTitle = sampleMeta.jobTitles.find((t) => t.id === body.jobTitleId);
      const department = sampleMeta.departments.find((d) => d.id === body.departmentId);
      if (!jobTitle) throw validation('jobTitleId', 'Unknown job title');
      if (!department) throw validation('departmentId', 'Unknown department');
      assertUniqueEmployee(body.email, body.employeeCode);
      const now = nowIso();
      const employee: Employee = {
        id: newId(),
        employeeCode: body.employeeCode ?? nextEmployeeCode(),
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        country: body.country,
        jobTitle,
        department,
        hireDate: body.hireDate,
        status: 'active',
        termination: null,
        salary: { amountMinor: body.salaryAmountMinor, currency: currencyFor(body.country) },
        salaryEffectiveDate: body.hireDate,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      store.employees.set(employee.id, employee);
      store.salaryChanges.set(employee.id, [
        {
          id: newId(),
          employeeId: employee.id,
          amount: employee.salary,
          previousAmount: null,
          effectiveDate: body.hireDate,
          reason: 'hire',
          note: null,
          importId: null,
          aiDraftId: null,
          createdAt: now,
          createdBy: { id: me.id, name: me.name },
        },
      ]);
      recordAudit(
        me,
        'employee.created',
        { type: 'employee', id: employee.id, label: employeeLabel(employee) },
        { country: employee.country, after: { ...body } },
      );
      return json(employee, {
        status: 201,
        headers: { Location: `/api/employees/${employee.id}` },
      });
    }),
  ),

  http.get(
    api('/employees/:id'),
    handle((me, info) => {
      requirePermission(me, 'employees:read');
      return json(getVisibleEmployee(me, param(info, 'id')));
    }),
  ),

  http.patch(
    api('/employees/:id'),
    handle(async (me, info) => {
      requirePermission(me, 'employees:write');
      const employee = getVisibleEmployee(me, param(info, 'id'));
      const { version, ...changes } = await parseBody(info.request, updateEmployeeRequestSchema);
      assertVersion(version, employee.version);
      if (changes.email) assertUniqueEmployee(changes.email, undefined, employee.id);
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (changes.jobTitleId) {
        const jobTitle = sampleMeta.jobTitles.find((t) => t.id === changes.jobTitleId);
        if (!jobTitle) throw validation('jobTitleId', 'Unknown job title');
        before.jobTitleId = employee.jobTitle.id;
        after.jobTitleId = jobTitle.id;
        employee.jobTitle = jobTitle;
      }
      if (changes.departmentId) {
        const department = sampleMeta.departments.find((d) => d.id === changes.departmentId);
        if (!department) throw validation('departmentId', 'Unknown department');
        before.departmentId = employee.department.id;
        after.departmentId = department.id;
        employee.department = department;
      }
      for (const key of ['firstName', 'lastName', 'email', 'hireDate'] as const) {
        const value = changes[key];
        if (value !== undefined && value !== employee[key]) {
          before[key] = employee[key];
          after[key] = value;
          employee[key] = value;
        }
      }
      touch(employee);
      recordAudit(
        me,
        'employee.updated',
        { type: 'employee', id: employee.id, label: employeeLabel(employee) },
        { country: employee.country, before, after },
      );
      return json(employee);
    }),
  ),

  http.post(
    api('/employees/:id/terminate'),
    handle(async (me, info) => {
      requirePermission(me, 'employees:terminate');
      const employee = getVisibleEmployee(me, param(info, 'id'));
      const body = await parseBody(info.request, terminateEmployeeRequestSchema);
      assertVersion(body.version, employee.version);
      if (employee.status === 'terminated') throw conflict('This employee has already left');
      employee.status = 'terminated';
      employee.termination = {
        date: body.terminationDate,
        reason: body.reason,
        note: body.note ?? null,
      };
      touch(employee);
      recordAudit(
        me,
        'employee.terminated',
        { type: 'employee', id: employee.id, label: employeeLabel(employee) },
        {
          country: employee.country,
          before: { status: 'active' },
          after: { status: 'terminated', ...employee.termination },
        },
      );
      return json(employee);
    }),
  ),

  http.get(
    api('/employees/:id/salary-changes'),
    handle((me, info) => {
      requirePermission(me, 'employees:read');
      const employee = getVisibleEmployee(me, param(info, 'id'));
      return json({ items: store.salaryChanges.get(employee.id) ?? [] });
    }),
  ),

  http.post(
    api('/employees/:id/salary-changes'),
    handle(async (me, info) => {
      requirePermission(me, 'salary:change');
      const employee = getVisibleEmployee(me, param(info, 'id'));
      const body = await parseBody(info.request, createSalaryChangeRequestSchema);
      assertVersion(body.version, employee.version);
      if (employee.status === 'terminated') throw conflict('This employee has left');
      const latest = latestSalaryChange(employee.id);
      if (latest && body.effectiveDate < latest.effectiveDate) {
        throw validation(
          'effectiveDate',
          `The effective date cannot be before the latest change (${latest.effectiveDate})`,
        );
      }
      if (body.effectiveDate > today()) {
        throw validation('effectiveDate', 'Future-dated changes are not supported yet');
      }
      const salaryChange = applySalaryChange(me, employee, body);
      return json({ salaryChange, employee }, { status: 201 });
    }),
  ),

  // -- Insights --

  http.get(
    api('/insights/overview'),
    handle((me) => {
      requirePermission(me, 'insights:read');
      return json(insights.overview(me));
    }),
  ),

  http.get(
    api('/insights/by-title'),
    handle((me, { request }) => {
      requirePermission(me, 'insights:read');
      const country = new URL(request.url).searchParams.get('country');
      if (!country) throw validation('country', 'country is required');
      return json(insights.byTitle(me, country));
    }),
  ),

  http.get(
    api('/insights/titles/:jobTitleId'),
    handle((me, info) => {
      requirePermission(me, 'insights:read');
      return json(insights.titleComparison(me, param(info, 'jobTitleId')));
    }),
  ),

  http.get(
    api('/insights/distribution'),
    handle((me, { request }) => {
      requirePermission(me, 'insights:read');
      const country = new URL(request.url).searchParams.get('country');
      if (!country) throw validation('country', 'country is required');
      return json(insights.distribution(me, country));
    }),
  ),

  // -- Import --

  http.get(
    api('/imports/template.xlsx'),
    handle((me) => {
      requirePermission(me, 'imports:run');
      return csv([sampleUpload.columns, ...sampleUpload.sampleRows], 'acme-import-template.csv');
    }),
  ),

  http.get(
    api('/imports'),
    handle((me) => {
      requirePermission(me, 'imports:run');
      return json({
        items: [...store.imports.values()].map(({ id, status, fileName, summary, createdAt }) => ({
          id,
          status,
          fileName,
          summary,
          createdAt,
        })),
      });
    }),
  ),

  http.post(
    api('/imports'),
    handle(async (me, { request }) => {
      requirePermission(me, 'imports:run');
      const form = await request.formData().catch(() => null);
      const file = form?.get('file');
      // Duck-typed rather than `instanceof File`: the File class differs per runtime.
      if (!file || typeof file === 'string')
        throw validation('file', 'Upload a .xlsx or .csv file');
      if (file.size > 5 * 1024 * 1024) {
        throw new MockApiError('payload_too_large', 'The file is over 5 MB');
      }
      const id = newId();
      store.imports.set(id, {
        id,
        status: 'uploaded',
        fileName: file.name,
        summary: null,
        createdAt: nowIso(),
        rows: [],
        applied: { createdIds: [], salaryReverts: [] },
      });
      return json({ ...sampleUpload, id, fileName: file.name }, { status: 201 });
    }),
  ),

  http.get(
    api('/imports/:id'),
    handle((me, info) => {
      requirePermission(me, 'imports:run');
      const { id, status, fileName, summary, createdAt } = findImport(param(info, 'id'));
      return json({ id, status, fileName, summary, createdAt });
    }),
  ),

  http.put(
    api('/imports/:id/mapping'),
    handle(async (me, info) => {
      requirePermission(me, 'imports:run');
      const record = findImport(param(info, 'id'));
      if (record.status === 'committed' || record.status === 'undone') {
        throw conflict('This import has already been applied');
      }
      const body = await parseBody(info.request, importMappingRequestSchema);
      if (!body.mapping.employeeCode && !body.mapping.email) {
        throw validation('mapping', 'Map the employee code or email column to match rows');
      }
      record.rows = buildImportRows();
      const count = (outcome: string) => record.rows.filter((r) => r.outcome === outcome).length;
      record.summary = {
        rows: sampleImportSummary.rows,
        create: count('create'),
        update: count('update'),
        error: count('error'),
        unchanged: sampleImportSummary.rows - count('create') - count('update') - count('error'),
      };
      record.status = 'validated';
      const { id, status, fileName, summary, createdAt } = record;
      return json({ id, status, fileName, summary, createdAt });
    }),
  ),

  http.get(
    api('/imports/:id/rows'),
    handle((me, info) => {
      requirePermission(me, 'imports:run');
      const record = findImport(param(info, 'id'));
      const url = new URL(info.request.url);
      const outcome = url.searchParams.get('outcome') ?? 'error';
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 25)));
      const rows = record.rows.filter((r) => r.outcome === outcome);
      return json({
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: rows.length,
      });
    }),
  ),

  http.get(
    api('/imports/:id/rows.csv'),
    handle((me, info) => {
      requirePermission(me, 'imports:run');
      const record = findImport(param(info, 'id'));
      const rows = record.rows.filter((r) => r.outcome === 'error');
      return csv(
        [
          ['row', 'employee code', 'column', 'error'],
          ...rows.flatMap((r) =>
            r.errors.map((e) => [r.rowNumber, r.employeeCode ?? '', e.column, e.message]),
          ),
        ],
        `import-errors-${record.id}.csv`,
      );
    }),
  ),

  http.post(
    api('/imports/:id/commit'),
    handle(async (me, info) => {
      requirePermission(me, 'imports:run');
      const record = findImport(param(info, 'id'));
      const body = await parseBody(info.request, commitImportRequestSchema);
      if (record.status !== 'validated') {
        throw conflict(
          record.status === 'committed'
            ? 'This import has already been committed'
            : 'Run the dry run before committing',
        );
      }
      if ((record.summary?.error ?? 0) > 0 && !body.skipInvalidRows) {
        throw validation('skipInvalidRows', 'The file has rows with errors; skip them to commit');
      }
      for (const row of record.rows) {
        if (row.outcome === 'update') {
          const employee = findEmployeeByCode(row.employeeCode);
          if (!employee || !me.countries.includes(employee.country)) continue;
          const salary = row.changes.salaryAmountMinor;
          if (typeof salary?.to === 'number') {
            const entry = applySalaryChange(me, employee, {
              amountMinor: salary.to,
              effectiveDate: today(),
              reason: 'import',
              importId: record.id,
            });
            record.applied.salaryReverts.push({ employeeId: employee.id, entry });
          }
          const title = row.changes.jobTitleId;
          const jobTitle = sampleMeta.jobTitles.find((t) => t.id === title?.to);
          if (jobTitle) {
            employee.jobTitle = jobTitle;
            touch(employee);
          }
        } else if (row.outcome === 'create') {
          const joiner = importJoiners.find((j) => j.employeeCode === row.employeeCode);
          if (!joiner || store.employees.has(joiner.id)) continue;
          const created: Employee = {
            ...structuredClone(joiner),
            status: 'active',
            termination: null,
            version: 1,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          store.employees.set(created.id, created);
          store.salaryChanges.set(created.id, [
            {
              id: newId(),
              employeeId: created.id,
              amount: created.salary,
              previousAmount: null,
              effectiveDate: created.hireDate,
              reason: 'import',
              note: null,
              importId: record.id,
              aiDraftId: null,
              createdAt: nowIso(),
              createdBy: { id: me.id, name: me.name },
            },
          ]);
          record.applied.createdIds.push(created.id);
        }
      }
      record.status = 'committed';
      recordAudit(
        me,
        'import.committed',
        { type: 'import', id: record.id, label: record.fileName },
        { after: { ...record.summary } },
        { importId: record.id },
      );
      const { id, status, fileName, summary, createdAt } = record;
      return json({ id, status, fileName, summary, createdAt });
    }),
  ),

  http.post(
    api('/imports/:id/undo'),
    handle((me, info) => {
      requirePermission(me, 'imports:run');
      const record = findImport(param(info, 'id'));
      if (record.status !== 'committed') throw conflict('Only a committed import can be undone');
      const blocked = record.applied.salaryReverts.filter(
        ({ employeeId, entry }) => latestSalaryChange(employeeId)?.id !== entry.id,
      );
      if (blocked.length > 0) {
        throw new MockApiError(
          'conflict',
          'Some employees have changed since the import, so it cannot be undone',
          blocked.map(({ employeeId }) => ({ path: 'employees', message: employeeId })),
        );
      }
      for (const { employeeId, entry } of record.applied.salaryReverts) {
        const employee = store.employees.get(employeeId);
        if (!employee || !entry.previousAmount) continue;
        applySalaryChange(me, employee, {
          amountMinor: entry.previousAmount.amountMinor,
          effectiveDate: today(),
          reason: 'import_undo',
          importId: record.id,
        });
      }
      for (const id of record.applied.createdIds) {
        store.employees.delete(id);
        store.salaryChanges.delete(id);
      }
      record.applied = { createdIds: [], salaryReverts: [] };
      record.status = 'undone';
      recordAudit(
        me,
        'import.undone',
        { type: 'import', id: record.id, label: record.fileName },
        {},
        { importId: record.id },
      );
      const { id, status, fileName, summary, createdAt } = record;
      return json({ id, status, fileName, summary, createdAt });
    }),
  ),

  // -- Ask AI --

  http.post(
    api('/ai/messages'),
    handle(async (me, { request }) => {
      requirePermission(me, 'ai:ask');
      const body = (await request.json().catch(() => null)) as {
        conversationId?: string;
        message?: string;
      } | null;
      if (!body?.message?.trim()) throw validation('message', 'Ask a question');
      const conversationId = body.conversationId ?? newId();
      const events = body.conversationId
        ? followUpEvents(me, conversationId, body.message)
        : firstTurnEvents(me, conversationId);
      return sse(events);
    }),
  ),

  http.get(
    api('/ai/conversations/:id'),
    handle(() => {
      throw notFound('conversation');
    }),
  ),

  // -- Audit --

  http.get(
    api('/audit-events'),
    handle((me, { request }) => {
      requirePermission(me, 'audit:read');
      const url = new URL(request.url);
      const entityType = url.searchParams.get('entityType');
      const entityId = url.searchParams.get('entityId');
      const action = url.searchParams.get('action');
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
      const offset = Number(url.searchParams.get('cursor') ?? 0) || 0;
      const rows: AuditEvent[] = store.audit.filter(
        (e) =>
          (!entityType || e.entity.type === entityType) &&
          (!entityId || e.entity.id === entityId) &&
          (!action || e.action === action) &&
          (e.country === null || me.countries.includes(e.country)),
      );
      const items = rows.slice(offset, offset + limit);
      return json({
        items,
        nextCursor: offset + limit < rows.length ? String(offset + limit) : null,
      });
    }),
  ),

  // -- Access: users --

  http.get(
    api('/users'),
    handle((me) => {
      requirePermission(me, 'users:manage');
      return json({ items: [...store.users.values()] });
    }),
  ),

  http.post(
    api('/users'),
    handle(async (me, { request }) => {
      requirePermission(me, 'users:manage');
      const body = await parseBody(request, inviteUserRequestSchema);
      const role = store.roles.get(body.roleId);
      if (!role) throw validation('roleId', 'Unknown role');
      assertHoldsPermissions(me, role.permissions);
      if (role.countryScope === 'assigned' && body.countries.length === 0) {
        throw validation('countries', 'Pick at least one country for this role');
      }
      if (
        [...store.users.values()].some((u) => u.email.toLowerCase() === body.email.toLowerCase())
      ) {
        throw conflict(`${body.email} already has access`);
      }
      const user: User = {
        id: newId(),
        name: body.name,
        email: body.email,
        role: roleRef(role),
        countries: role.countryScope === 'all' ? [] : body.countries,
        status: 'invited',
        lastSignInAt: null,
        version: 1,
      };
      store.users.set(user.id, user);
      role.userCount += 1;
      recordAudit(
        me,
        'user.invited',
        { type: 'user', id: user.id, label: user.name },
        { after: { roleId: role.id, countries: user.countries } },
      );
      return json(
        { user, inviteUrl: `https://people.acme.test/invite/${user.id.slice(-12)}` },
        { status: 201 },
      );
    }),
  ),

  http.patch(
    api('/users/:id'),
    handle(async (me, info) => {
      requirePermission(me, 'users:manage');
      const user = findUser(param(info, 'id'));
      const body = await parseBody(info.request, updateUserRequestSchema);
      assertVersion(body.version, user.version);
      if (user.id === me.id) throw conflict('You cannot change your own access');
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (body.roleId && body.roleId !== user.role.id) {
        const role = store.roles.get(body.roleId);
        if (!role) throw validation('roleId', 'Unknown role');
        assertHoldsPermissions(me, role.permissions);
        if (
          user.role.key === 'global_hr' &&
          user.status === 'active' &&
          activeGlobalHrCount() <= 1
        ) {
          throw conflict('ACME needs at least one active Global HR user');
        }
        const previous = store.roles.get(user.role.id);
        if (previous) previous.userCount = Math.max(0, previous.userCount - 1);
        role.userCount += 1;
        before.roleId = user.role.id;
        after.roleId = role.id;
        user.role = roleRef(role);
        if (role.countryScope === 'all') user.countries = [];
      }
      if (body.countries) {
        const role = store.roles.get(user.role.id);
        if (role?.countryScope === 'assigned' && body.countries.length === 0) {
          throw validation('countries', 'Pick at least one country for this role');
        }
        before.countries = user.countries;
        after.countries = body.countries;
        user.countries = role?.countryScope === 'all' ? [] : body.countries;
      }
      user.version += 1;
      recordAudit(
        me,
        'user.updated',
        { type: 'user', id: user.id, label: user.name },
        { before, after },
      );
      return json(user);
    }),
  ),

  http.post(
    api('/users/:id/deactivate'),
    handle((me, info) => {
      requirePermission(me, 'users:manage');
      const user = findUser(param(info, 'id'));
      if (user.id === me.id) throw conflict('You cannot deactivate yourself');
      if (user.status === 'deactivated') throw conflict('This user is already deactivated');
      if (user.role.key === 'global_hr' && user.status === 'active' && activeGlobalHrCount() <= 1) {
        throw conflict('ACME needs at least one active Global HR user');
      }
      const before = { status: user.status };
      user.status = 'deactivated';
      user.version += 1;
      const role = store.roles.get(user.role.id);
      if (role) role.userCount = Math.max(0, role.userCount - 1);
      recordAudit(
        me,
        'user.deactivated',
        { type: 'user', id: user.id, label: user.name },
        {
          before,
          after: { status: 'deactivated' },
        },
      );
      return json(user);
    }),
  ),

  http.post(
    api('/users/:id/reactivate'),
    handle((me, info) => {
      requirePermission(me, 'users:manage');
      const user = findUser(param(info, 'id'));
      if (user.status !== 'deactivated') throw conflict('This user is not deactivated');
      user.status = 'active';
      user.version += 1;
      const role = store.roles.get(user.role.id);
      if (role) role.userCount += 1;
      recordAudit(
        me,
        'user.updated',
        { type: 'user', id: user.id, label: user.name },
        {
          before: { status: 'deactivated' },
          after: { status: 'active' },
        },
      );
      return json(user);
    }),
  ),

  http.post(
    api('/users/:id/invite'),
    handle((me, info) => {
      requirePermission(me, 'users:manage');
      const user = findUser(param(info, 'id'));
      return json({ user, inviteUrl: `https://people.acme.test/invite/${newId().slice(-12)}` });
    }),
  ),

  // -- Access: roles and permissions --

  http.get(
    api('/permissions'),
    handle((me) => {
      requirePermission(me, 'roles:manage');
      return json({ items: store.permissions });
    }),
  ),

  http.get(
    api('/roles'),
    handle((me) => {
      if (!me.permissions.includes('users:manage') && !me.permissions.includes('roles:manage')) {
        throw forbidden('roles:manage');
      }
      return json({ items: [...store.roles.values()] });
    }),
  ),

  http.post(
    api('/roles'),
    handle(async (me, { request }) => {
      requirePermission(me, 'roles:manage');
      const body = await parseBody(request, createRoleRequestSchema);
      assertRequirements(body.permissions);
      assertHoldsPermissions(me, body.permissions);
      if ([...store.roles.values()].some((r) => r.name.toLowerCase() === body.name.toLowerCase())) {
        throw conflict(`A role called ${body.name} already exists`);
      }
      const role: Role = {
        id: newId(),
        key: uniqueRoleKey(body.name),
        name: body.name,
        description: body.description ?? null,
        countryScope: body.countryScope,
        isSystem: false,
        permissions: [...new Set(body.permissions)],
        userCount: 0,
        version: 1,
      };
      store.roles.set(role.id, role);
      recordAudit(
        me,
        'role.created',
        { type: 'role', id: role.id, label: role.name },
        {
          after: { permissions: role.permissions, countryScope: role.countryScope },
        },
      );
      return json(role, { status: 201 });
    }),
  ),

  http.patch(
    api('/roles/:id'),
    handle(async (me, info) => {
      requirePermission(me, 'roles:manage');
      const role = findRole(param(info, 'id'));
      const body = await parseBody(info.request, updateRoleRequestSchema);
      assertVersion(body.version, role.version);
      if (role.key === 'global_hr') throw conflict('The Global HR role cannot be changed');
      if (role.id === me.role.id) throw forbidden('roles:manage');
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (body.permissions) {
        assertRequirements(body.permissions);
        assertHoldsPermissions(me, body.permissions);
        before.permissions = role.permissions;
        after.permissions = [...new Set(body.permissions)];
        role.permissions = [...new Set(body.permissions)];
      }
      if (body.name !== undefined && body.name !== role.name) {
        before.name = role.name;
        after.name = body.name;
        role.name = body.name;
        for (const user of store.users.values()) {
          if (user.role.id === role.id) user.role = roleRef(role);
        }
      }
      if (body.description !== undefined) {
        before.description = role.description;
        after.description = body.description;
        role.description = body.description;
      }
      role.version += 1;
      recordAudit(
        me,
        'role.updated',
        { type: 'role', id: role.id, label: role.name },
        { before, after },
      );
      return json(role);
    }),
  ),

  http.delete(
    api('/roles/:id'),
    handle((me, info) => {
      requirePermission(me, 'roles:manage');
      const role = findRole(param(info, 'id'));
      if (role.isSystem) throw conflict('System roles cannot be deleted');
      if (role.userCount > 0) throw conflict('Move the people holding this role first');
      store.roles.delete(role.id);
      recordAudit(
        me,
        'role.deleted',
        { type: 'role', id: role.id, label: role.name },
        {
          before: { permissions: role.permissions },
        },
      );
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  // -- Anything else under /api is an unknown route --

  http.all(
    api('/*'),
    handle(() => {
      throw notFound('route');
    }),
  ),
];

/** Streams events as SSE, one `data:` block each, pausing between them so the UI fills in. */
function sse(events: AiStreamEvent[]) {
  const encoder = new TextEncoder();
  const gap = mockConfig.streamGapMs;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap));
      }
      controller.close();
    },
  });
  return new HttpResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
