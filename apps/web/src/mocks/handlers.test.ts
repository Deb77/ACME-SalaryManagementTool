/**
 * Drives the mock API through `msw/node` and checks every response against the shared Zod
 * contract, so the mock cannot drift from what the real API promises.
 */
import {
  aiStreamEventSchema,
  apiErrorBodySchema,
  createSalaryChangeResponseSchema,
  cursorPageSchema,
  auditEventSchema,
  employeeSchema,
  importRowSchema,
  importSchema,
  importUploadResponseSchema,
  insightsByTitleSchema,
  insightsOverviewSchema,
  inviteUserResponseSchema,
  meSchema,
  metaSchema,
  pageSchema,
  permissionCatalogueSchema,
  roleSchema,
  rolesResponseSchema,
  salaryDistributionSchema,
  salaryHistoryResponseSchema,
  titleComparisonSchema,
  userSchema,
  usersResponseSchema,
  type Employee,
} from '@acme/shared';
import { File as NodeFile } from 'node:buffer';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { parseSseBuffer } from '../api/askStream';
import { sampleEmployees, sampleRoles, sampleUsers } from '../stories/screenSampleData';
import { handlers } from './handlers';
import { setMockUser } from './mockUser';
import { resetStore, store } from './store';

const server = setupServer(...handlers);
const base = `${window.location.origin}/api`;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  resetStore();
  setMockUser('global_hr');
});

async function call<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit & { json?: unknown },
): Promise<z.infer<S>> {
  const response = await send(path, init);
  expect(response.ok, `${init?.method ?? 'GET'} ${path} → ${response.status}`).toBe(true);
  return schema.parse(await response.json());
}

function send(path: string, init?: RequestInit & { json?: unknown }) {
  const { json, ...rest } = init ?? {};
  return fetch(`${base}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = apiErrorBodySchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  return body;
}

const priya = sampleEmployees[0]!;
const employeePage = pageSchema(employeeSchema);

describe('session and catalogue', () => {
  it('serves /auth/me and /meta in the shared shapes', async () => {
    const me = await call('/auth/me', meSchema);
    expect(me.role.key).toBe('global_hr');
    await call('/meta', metaSchema);
  });

  it('switches the signed-in user', async () => {
    setMockUser('country_hr');
    const me = await call('/auth/me', meSchema);
    expect(me.countries).toEqual(['IN']);
  });

  it('returns the error envelope for unknown routes', async () => {
    await expectError(await send('/nope'), 404, 'not_found');
  });
});

describe('employees', () => {
  it('pages the list with a total', async () => {
    const page1 = await call('/employees?page=1&pageSize=10', employeePage);
    const page2 = await call('/employees?page=2&pageSize=10', employeePage);
    expect(page1.items).toHaveLength(10);
    expect(page1.page).toBe(1);
    expect(page1.total).toBeGreaterThan(20);
    expect(page2.items.map((e) => e.id)).not.toEqual(page1.items.map((e) => e.id));
    const all = await call(`/employees?pageSize=100`, employeePage);
    expect(all.items).toHaveLength(all.total);
    expect(all.items.every((e) => e.status === 'active')).toBe(true);
  });

  it('filters by country, department, job title, status and search text', async () => {
    const india = await call('/employees?country=IN&pageSize=100', employeePage);
    expect(india.items.length).toBeGreaterThan(0);
    expect(india.items.every((e) => e.country === 'IN')).toBe(true);

    const multi = await call('/employees?country=IN,GB&pageSize=100', employeePage);
    expect(multi.items.every((e) => e.country === 'IN' || e.country === 'GB')).toBe(true);
    expect(multi.total).toBeGreaterThan(india.total);

    const analysts = await call(
      '/employees?jobTitle=data-analyst&department=data&pageSize=100',
      employeePage,
    );
    expect(
      analysts.items.every((e) => e.jobTitle.id === 'data-analyst' && e.department.id === 'data'),
    ).toBe(true);

    const left = await call('/employees?status=terminated&pageSize=100', employeePage);
    expect(left.items.length).toBeGreaterThan(0);
    expect(left.items.every((e) => e.status === 'terminated')).toBe(true);

    const search = await call('/employees?q=priya', employeePage);
    expect(search.items.some((e) => e.id === priya.id)).toBe(true);
    const byCode = await call(`/employees?q=${priya.employeeCode}`, employeePage);
    expect(byCode.items.map((e) => e.id)).toEqual([priya.id]);
  });

  it('sorts by the allow-listed fields and rejects salary sort across countries', async () => {
    const desc = await call('/employees?sort=-hireDate&pageSize=100', employeePage);
    const dates = desc.items.map((e) => e.hireDate);
    expect(dates).toEqual([...dates].sort().reverse());

    const bySalary = await call('/employees?country=IN&sort=salary&pageSize=100', employeePage);
    const amounts = bySalary.items.map((e) => e.salary.amountMinor);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));

    await expectError(await send('/employees?sort=salary'), 400, 'validation_error');
    await expectError(await send('/employees?sort=shoeSize'), 400, 'validation_error');
    await expectError(await send('/employees?pageSize=500'), 400, 'validation_error');
  });

  it('scopes Country HR to their countries and hides others as 404', async () => {
    const all = await call('/employees?pageSize=100', employeePage);
    const abroad = all.items.find((e) => e.country !== 'IN')!;
    setMockUser('country_hr');
    const scoped = await call('/employees?pageSize=100', employeePage);
    expect(scoped.items.every((e) => e.country === 'IN')).toBe(true);
    await expectError(await send(`/employees/${abroad.id}`), 404, 'not_found');
    await call(`/employees/${priya.id}`, employeeSchema);
  });

  it('creates an employee that then appears in the list, and rejects a duplicate email', async () => {
    const body = {
      firstName: 'Asha',
      lastName: 'Rao',
      email: 'asha.rao@acme.com',
      country: 'IN',
      jobTitleId: 'data-analyst',
      departmentId: 'data',
      hireDate: '2026-11-02',
      salaryAmountMinor: 180_000_000,
    };
    const response = await send('/employees', { method: 'POST', json: body });
    expect(response.status).toBe(201);
    expect(response.headers.get('Location')).toMatch(/^\/api\/employees\//);
    const created = employeeSchema.parse(await response.json());
    expect(created.salary).toEqual({ amountMinor: 180_000_000, currency: 'INR' });
    expect(created.employeeCode).toMatch(/^ACME-\d{5}$/);

    const list = await call('/employees?q=asha.rao', employeePage);
    expect(list.items.map((e) => e.id)).toEqual([created.id]);
    const history = await call(
      `/employees/${created.id}/salary-changes`,
      salaryHistoryResponseSchema,
    );
    expect(history.items.map((h) => h.reason)).toEqual(['hire']);

    const duplicate = await expectError(
      await send('/employees', { method: 'POST', json: { ...body, firstName: 'Other' } }),
      409,
      'conflict',
    );
    expect(duplicate.error.message).toMatch(/email/i);
    await expectError(
      await send('/employees', {
        method: 'POST',
        json: { ...body, email: 'x@acme.com', currency: 'INR' },
      }),
      400,
      'validation_error',
    );
  });

  it('refuses to create outside Country HR scope', async () => {
    setMockUser('country_hr');
    await expectError(
      await send('/employees', {
        method: 'POST',
        json: {
          firstName: 'Tom',
          lastName: 'Patel',
          email: 'tom.patel@acme.com',
          country: 'GB',
          jobTitleId: 'data-analyst',
          departmentId: 'data',
          hireDate: '2026-11-02',
          salaryAmountMinor: 5_000_000,
        },
      }),
      403,
      'forbidden',
    );
  });

  it('updates with a version check', async () => {
    const updated = await call(`/employees/${priya.id}`, employeeSchema, {
      method: 'PATCH',
      json: { jobTitleId: 'engineering-manager', version: priya.version },
    });
    expect(updated.jobTitle.id).toBe('engineering-manager');
    expect(updated.version).toBe(priya.version + 1);
    await expectError(
      await send(`/employees/${priya.id}`, {
        method: 'PATCH',
        json: { firstName: 'P', version: priya.version },
      }),
      409,
      'stale_version',
    );
    await expectError(
      await send(`/employees/${priya.id}`, {
        method: 'PATCH',
        json: { salaryAmountMinor: 1, version: updated.version },
      }),
      400,
      'validation_error',
    );
  });

  it('records a salary change and updates the employee', async () => {
    const result = await call(
      `/employees/${priya.id}/salary-changes`,
      createSalaryChangeResponseSchema,
      {
        method: 'POST',
        json: {
          amountMinor: 350_000_000,
          effectiveDate: '2026-11-01',
          reason: 'market_adjustment',
          version: priya.version,
        },
      },
    );
    expect(result.employee.salary.amountMinor).toBe(350_000_000);
    expect(result.salaryChange.previousAmount).toEqual(priya.salary);
    const detail = await call(`/employees/${priya.id}`, employeeSchema);
    expect(detail.version).toBe(priya.version + 1);
    const history = await call(
      `/employees/${priya.id}/salary-changes`,
      salaryHistoryResponseSchema,
    );
    expect(history.items[0]?.id).toBe(result.salaryChange.id);

    await expectError(
      await send(`/employees/${priya.id}/salary-changes`, {
        method: 'POST',
        json: {
          amountMinor: 1,
          effectiveDate: '2026-11-01',
          reason: 'annual_review',
          version: priya.version,
        },
      }),
      409,
      'stale_version',
    );
    await expectError(
      await send(`/employees/${priya.id}/salary-changes`, {
        method: 'POST',
        json: {
          amountMinor: 1,
          effectiveDate: '2020-01-01',
          reason: 'annual_review',
          version: detail.version,
        },
      }),
      400,
      'validation_error',
    );
  });

  it('terminates once', async () => {
    const left = await call(`/employees/${priya.id}/terminate`, employeeSchema, {
      method: 'POST',
      json: { terminationDate: '2026-12-31', reason: 'resignation', version: priya.version },
    });
    expect(left.status).toBe('terminated');
    const active = await call(`/employees?q=${priya.employeeCode}`, employeePage);
    expect(active.total).toBe(0);
    await expectError(
      await send(`/employees/${priya.id}/terminate`, {
        method: 'POST',
        json: { terminationDate: '2026-12-31', reason: 'resignation', version: left.version },
      }),
      409,
      'conflict',
    );
  });

  it('exports CSV with the list filters', async () => {
    const response = await send('/employees/export.csv?country=IN');
    expect(response.headers.get('Content-Type')).toMatch(/text\/csv/);
    const text = await response.text();
    expect(text.split('\n')[0]).toMatch(/^code,first name/);
  });
});

describe('insights', () => {
  it('serves every insights shape, scoped to the user', async () => {
    await call('/insights/overview', insightsOverviewSchema);
    await call('/insights/by-title?country=GB', insightsByTitleSchema);
    const comparison = await call('/insights/titles/data-analyst', titleComparisonSchema);
    expect(comparison.rows.length).toBeGreaterThan(1);
    await call('/insights/distribution?country=IN&buckets=9', salaryDistributionSchema);

    setMockUser('country_hr');
    const overview = await call('/insights/overview', insightsOverviewSchema);
    expect(overview.countries.map((c) => c.country)).toEqual(['IN']);
    await expectError(await send('/insights/by-title?country=GB'), 403, 'forbidden');
    await expectError(await send('/insights/titles/astronaut'), 404, 'not_found');
  });

  it('is forbidden without insights:read', async () => {
    setMockUser('readonly');
    await call('/insights/overview', insightsOverviewSchema);
    await expectError(await send('/users'), 403, 'forbidden');
    await expectError(
      await send('/ai/messages', { method: 'POST', json: { message: 'hi' } }),
      403,
      'forbidden',
    );
  });
});

describe('ask AI', () => {
  it('streams schema-valid events with a draft to approve', async () => {
    const response = await send('/ai/messages', {
      method: 'POST',
      json: { message: 'Who is underpaid?' },
    });
    expect(response.headers.get('Content-Type')).toMatch(/text\/event-stream/);
    const { events, rest } = parseSseBuffer(`${await response.text()}\n\n`);
    expect(rest).toBe('');
    events.forEach((event) => aiStreamEventSchema.parse(event));
    expect(events[0]?.type).toBe('conversation');
    expect(events.filter((e) => e.type === 'tool_call')).toHaveLength(3);
    expect(events.filter((e) => e.type === 'text').length).toBeGreaterThan(5);
    expect(events.some((e) => e.type === 'draft_salary_change')).toBe(true);
    expect(events.at(-1)?.type).toBe('done');

    const conversationId = events[0]?.type === 'conversation' ? events[0].conversationId : '';
    const followUp = await send('/ai/messages', {
      method: 'POST',
      json: { conversationId, message: 'And in Brazil?' },
    });
    const second = parseSseBuffer(`${await followUp.text()}\n\n`).events;
    expect(second.at(-1)?.type).toBe('done');
    expect(second.some((e) => e.type === 'text')).toBe(true);
  });
});

describe('imports', () => {
  // Node's multipart parser builds Files with the global `File`, and rejects jsdom's version.
  beforeAll(() => vi.stubGlobal('File', NodeFile));
  afterAll(() => vi.unstubAllGlobals());

  async function upload() {
    // Hand-built multipart body: jsdom's FormData is not the one Node's fetch understands.
    const boundary = 'acme-mock-test-boundary';
    const body =
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="india_salaries_nov2026.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\nEmp ID,Name\r\n--${boundary}--\r\n`;
    const response = await send('/imports', {
      method: 'POST',
      body,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    });
    expect(response.status).toBe(201);
    return importUploadResponseSchema.parse(await response.json());
  }

  it('runs upload → mapping → review → commit → undo, changing the directory', async () => {
    const uploaded = await upload();
    expect(uploaded.fileName).toBe('india_salaries_nov2026.csv');

    const validated = await call(`/imports/${uploaded.id}/mapping`, importSchema, {
      method: 'PUT',
      json: { mapping: uploaded.suggestedMapping, defaults: { country: 'IN' } },
    });
    expect(validated.status).toBe('validated');
    expect(validated.summary?.create).toBe(3);
    expect(validated.summary?.error).toBeGreaterThan(0);

    const errors = await call(
      `/imports/${uploaded.id}/rows?outcome=error&page=1&pageSize=25`,
      pageSchema(importRowSchema),
    );
    expect(errors.total).toBe(validated.summary?.error);
    const creates = await call(
      `/imports/${uploaded.id}/rows?outcome=create&page=1&pageSize=25`,
      pageSchema(importRowSchema),
    );
    expect(creates.items).toHaveLength(3);

    await expectError(
      await send(`/imports/${uploaded.id}/commit`, {
        method: 'POST',
        json: { skipInvalidRows: false },
      }),
      400,
      'validation_error',
    );
    const before = (await call('/employees?pageSize=100', employeePage)).total;
    const committed = await call(`/imports/${uploaded.id}/commit`, importSchema, {
      method: 'POST',
      json: { skipInvalidRows: true },
    });
    expect(committed.status).toBe('committed');
    const after = await call('/employees?pageSize=100', employeePage);
    expect(after.total).toBe(before + 3);
    const priyaNow = after.items.find((e) => e.id === priya.id) as Employee;
    expect(priyaNow.salary.amountMinor).toBe(350_000_000);
    await expectError(
      await send(`/imports/${uploaded.id}/commit`, {
        method: 'POST',
        json: { skipInvalidRows: true },
      }),
      409,
      'conflict',
    );

    const undone = await call(`/imports/${uploaded.id}/undo`, importSchema, { method: 'POST' });
    expect(undone.status).toBe('undone');
    const reverted = await call('/employees?pageSize=100', employeePage);
    expect(reverted.total).toBe(before);
    expect(reverted.items.find((e) => e.id === priya.id)?.salary).toEqual(priya.salary);
    const history = await call(
      `/employees/${priya.id}/salary-changes`,
      salaryHistoryResponseSchema,
    );
    expect(history.items.slice(0, 2).map((h) => h.reason)).toEqual(['import_undo', 'import']);
    await expectError(
      await send(`/imports/${uploaded.id}/undo`, { method: 'POST' }),
      409,
      'conflict',
    );
  });

  it('blocks undo once someone else changed an imported employee', async () => {
    const uploaded = await upload();
    await call(`/imports/${uploaded.id}/mapping`, importSchema, {
      method: 'PUT',
      json: { mapping: uploaded.suggestedMapping },
    });
    await call(`/imports/${uploaded.id}/commit`, importSchema, {
      method: 'POST',
      json: { skipInvalidRows: true },
    });
    const current = await call(`/employees/${priya.id}`, employeeSchema);
    await call(`/employees/${priya.id}/salary-changes`, createSalaryChangeResponseSchema, {
      method: 'POST',
      json: {
        amountMinor: 360_000_000,
        effectiveDate: current.salaryEffectiveDate,
        reason: 'promotion',
        version: current.version,
      },
    });
    await expectError(
      await send(`/imports/${uploaded.id}/undo`, { method: 'POST' }),
      409,
      'conflict',
    );
  });
});

describe('access', () => {
  const countryRole = sampleRoles[1]!;

  it('lists users, roles, permissions and recent changes', async () => {
    await call('/users', usersResponseSchema);
    await call('/roles', rolesResponseSchema);
    await call('/permissions', permissionCatalogueSchema);
    const changes = await call(
      '/audit-events?entityType=user&limit=5',
      cursorPageSchema(auditEventSchema),
    );
    expect(changes.items.length).toBeGreaterThan(0);
    expect(changes.items.every((e) => e.entity.type === 'user')).toBe(true);
  });

  it('invites a user who then shows up, and rejects a duplicate email', async () => {
    const response = await send('/users', {
      method: 'POST',
      json: {
        name: 'Asha Rao',
        email: 'asha.rao@acme.com',
        roleId: countryRole.id,
        countries: ['IN'],
      },
    });
    expect(response.status).toBe(201);
    const { user, inviteUrl } = inviteUserResponseSchema.parse(await response.json());
    expect(user.status).toBe('invited');
    expect(inviteUrl).toMatch(/^https:/);
    const users = await call('/users', usersResponseSchema);
    expect(users.items.some((u) => u.id === user.id)).toBe(true);
    const roles = await call('/roles', rolesResponseSchema);
    expect(roles.items.find((r) => r.id === countryRole.id)?.userCount).toBe(
      countryRole.userCount + 1,
    );
    const changes = await call(
      '/audit-events?entityType=user&limit=5',
      cursorPageSchema(auditEventSchema),
    );
    expect(changes.items[0]?.action).toBe('user.invited');

    await expectError(
      await send('/users', {
        method: 'POST',
        json: {
          name: 'Again',
          email: 'ASHA.RAO@acme.com',
          roleId: countryRole.id,
          countries: ['IN'],
        },
      }),
      409,
      'conflict',
    );
    await expectError(
      await send('/users', {
        method: 'POST',
        json: { name: 'No country', email: 'nc@acme.com', roleId: countryRole.id, countries: [] },
      }),
      400,
      'validation_error',
    );
  });

  it('edits and deactivates users with the documented 409s', async () => {
    const sarah = sampleUsers[3]!;
    const updated = await call(`/users/${sarah.id}`, userSchema, {
      method: 'PATCH',
      json: { countries: ['US'], version: sarah.version },
    });
    expect(updated.countries).toEqual(['US']);
    await expectError(
      await send(`/users/${sarah.id}`, {
        method: 'PATCH',
        json: { countries: ['CA'], version: sarah.version },
      }),
      409,
      'stale_version',
    );
    const me = await call('/auth/me', meSchema);
    await expectError(
      await send(`/users/${me.id}/deactivate`, { method: 'POST' }),
      409,
      'conflict',
    );
    const gone = await call(`/users/${sarah.id}/deactivate`, userSchema, { method: 'POST' });
    expect(gone.status).toBe('deactivated');
    // Daniel is the only other active Global HR: deactivating him leaves Riya, which is allowed.
    const daniel = sampleUsers[1]!;
    await call(`/users/${daniel.id}/deactivate`, userSchema, { method: 'POST' });
    expect(store.users.get(daniel.id)?.status).toBe('deactivated');
  });

  it('creates, edits and deletes roles with dependency and system checks', async () => {
    await expectError(
      await send('/roles', {
        method: 'POST',
        json: { name: 'Broken', countryScope: 'all', permissions: ['employees:write'] },
      }),
      400,
      'validation_error',
    );
    const created = await call('/roles', roleSchema, {
      method: 'POST',
      json: {
        name: 'Payroll viewer',
        countryScope: 'all',
        permissions: ['employees:read', 'employees:export'],
      },
    });
    expect(created.key).toBe('payroll-viewer');
    const edited = await call(`/roles/${created.id}`, roleSchema, {
      method: 'PATCH',
      json: { name: 'Payroll', permissions: ['employees:read'], version: created.version },
    });
    expect(edited.name).toBe('Payroll');
    expect(
      (await call('/roles', rolesResponseSchema)).items.some((r) => r.name === 'Payroll'),
    ).toBe(true);

    await expectError(
      await send(`/roles/${sampleRoles[0]!.id}`, {
        method: 'PATCH',
        json: { name: 'Root', version: 1 },
      }),
      409,
      'conflict',
    );
    await expectError(
      await send(`/roles/${countryRole.id}`, { method: 'DELETE' }),
      409,
      'conflict',
    );
    const deleted = await send(`/roles/${created.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
    expect((await call('/roles', rolesResponseSchema)).items.some((r) => r.id === created.id)).toBe(
      false,
    );
  });
});
