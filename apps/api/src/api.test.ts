import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import {
  auditEventSchema,
  createSalaryChangeResponseSchema,
  cursorPageSchema,
  employeeSchema,
  importSchema,
  importUploadResponseSchema,
  insightsByTitleSchema,
  insightsOverviewSchema,
  inviteInfoSchema,
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
  usersResponseSchema,
  importRowSchema,
} from '@acme/shared';
import { createApp } from './app.js';
import type { Config } from './config.js';
import { buildContainer, type AppContainer } from './container.js';
import { createDb, type Db } from './db/database.js';
import { migrateToLatest } from './db/migrate.js';
import { seedDatabase } from './db/seed/seed.js';
import type { Clock } from './lib/clock.js';

/**
 * The HTTP API against a real Postgres with row-level security on, through the same container
 * the server uses. Skipped unless TEST_DATABASE_URL is set; it drops and recreates the schema.
 */
const url = process.env.TEST_DATABASE_URL;
const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'integration-test-password';
const GLOBAL = 'global.hr@demo.acme.test';
const INDIA = 'india.hr@demo.acme.test';
const fixedClock: Clock = { now: () => new Date(), today: () => '2026-11-20' };

type Agent = ReturnType<typeof request.agent>;

describe.skipIf(!url)('HTTP API', () => {
  let owner: Db;
  let container: AppContainer;
  let app: Express;
  let globalHr: Agent;
  let indiaHr: Agent;

  async function signIn(email: string, password = PASSWORD): Promise<Agent> {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/sign-in')
      .set('Origin', ORIGIN)
      .send({ email, password });
    expect(res.status, res.text).toBe(200);
    return agent;
  }

  const send = (
    agent: Agent,
    method: 'post' | 'patch' | 'put' | 'delete',
    path: string,
    body?: object,
  ) => agent[method](path).set('Origin', ORIGIN).send(body);

  async function employeeIn(country: string): Promise<{ id: string; version: number }> {
    const { rows } = await owner.execute<{ id: string; version: number }>(
      sql`select id, version from employees where country_code = ${country} and status = 'active' order by employee_code limit 1`,
    );
    return rows[0]!;
  }

  beforeAll(async () => {
    owner = createDb(url!, { max: 2 });
    await owner.execute(sql`drop schema if exists drizzle cascade`);
    await owner.execute(sql`drop schema if exists app_private cascade`);
    await owner.execute(sql`drop schema public cascade`);
    await owner.execute(sql`create schema public`);
    await migrateToLatest(owner);
    await seedDatabase(owner, {
      employees: 400,
      seed: 11,
      asOf: '2026-11-01',
      reset: true,
      demoUsers: true,
      demoPassword: PASSWORD,
      log: () => {},
    });
    const config: Config = {
      databaseUrl: url!,
      allowedOrigins: [ORIGIN],
      appUrl: ORIGIN,
      secureCookies: false,
      dbPoolSize: 4,
      authRateLimit: 1000,
    };
    container = buildContainer(config).override('clock', () => fixedClock);
    container.override('logger', () => ({ error: () => {}, info: () => {} }));
    app = createApp({ container });
    globalHr = await signIn(GLOBAL);
    indiaHr = await signIn(INDIA);
  }, 120_000);

  afterAll(async () => {
    await container?.resolve('db').$client.end();
    await owner?.$client.end();
  });

  describe('auth', () => {
    it('rejects a wrong password with the generic 401', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in')
        .set('Origin', ORIGIN)
        .send({ email: GLOBAL, password: 'wrong password!' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('unauthenticated');
    });

    it('gives the same answer for an unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in')
        .set('Origin', ORIGIN)
        .send({ email: 'nobody@acme.test', password: PASSWORD });
      expect(res.status).toBe(401);
    });

    it('returns the signed-in user with resolved countries', async () => {
      const res = await indiaHr.get('/api/auth/me');
      const me = meSchema.parse(res.body);
      expect(me.countries).toEqual(['IN']);
      expect(me.permissions).not.toContain('users:manage');
    });

    it('sets an HttpOnly, SameSite=Lax session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in')
        .set('Origin', ORIGIN)
        .send({ email: GLOBAL, password: PASSWORD });
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/acme_session=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
    });

    it('blocks state-changing requests from another origin (CSRF)', async () => {
      const res = await globalHr.post('/api/employees').set('Origin', 'https://evil.test').send({});
      expect(res.status).toBe(403);
      const noOrigin = await globalHr.post('/api/employees').send({});
      expect(noOrigin.status).toBe(403);
    });

    it('ends the session on sign-out', async () => {
      const agent = await signIn(GLOBAL);
      expect((await send(agent, 'post', '/api/auth/sign-out')).status).toBe(204);
      expect((await agent.get('/api/auth/me')).status).toBe(401);
    });
  });

  describe('permission matrix', () => {
    const routes: [string, string][] = [
      ['get', '/api/meta'],
      ['get', '/api/employees'],
      ['get', '/api/employees/export.csv'],
      ['get', '/api/insights/overview'],
      ['get', '/api/audit-events'],
      ['get', '/api/imports'],
      ['get', '/api/users'],
      ['get', '/api/roles'],
      ['get', '/api/permissions'],
    ];

    it.each(routes)('%s %s needs a session', async (method, path) => {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method
      ]!(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('unauthenticated');
    });

    it('returns 403 naming the permission Country HR lacks', async () => {
      for (const path of ['/api/users', '/api/permissions', '/api/roles']) {
        const res = await indiaHr.get(path);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('forbidden');
      }
    });
  });

  describe('catalogue', () => {
    it('serves meta with an ETag and answers 304 when unchanged', async () => {
      const res = await globalHr.get('/api/meta');
      metaSchema.parse(res.body);
      const again = await globalHr.get('/api/meta').set('If-None-Match', res.headers.etag!);
      expect(again.status).toBe(304);
    });
  });

  describe('employees and country scope', () => {
    it('lists only in-scope employees for Country HR', async () => {
      const res = await indiaHr.get('/api/employees?pageSize=100&status=all');
      const page = pageSchema(employeeSchema).parse(res.body);
      expect(page.total).toBeGreaterThan(0);
      expect(new Set(page.items.map((e) => e.country))).toEqual(new Set(['IN']));
    });

    it('answers 404, not 403, for an out-of-scope employee', async () => {
      const gb = await employeeIn('GB');
      expect((await indiaHr.get(`/api/employees/${gb.id}`)).status).toBe(404);
      expect((await indiaHr.get(`/api/employees/${gb.id}/salary-changes`)).status).toBe(404);
      const write = await send(indiaHr, 'patch', `/api/employees/${gb.id}`, {
        firstName: 'X',
        version: gb.version,
      });
      expect(write.status).toBe(404);
    });

    it('rejects filters that are not in the catalogue', async () => {
      expect((await globalHr.get('/api/employees?country=ZZ')).status).toBe(400);
      expect((await globalHr.get('/api/employees?jobTitle=astronaut')).status).toBe(400);
    });

    it('rejects future hire and termination dates and implausible salaries', async () => {
      const base = {
        firstName: 'Future',
        lastName: 'Hire',
        email: 'future.hire@acme.test',
        country: 'IN',
        jobTitleId: 'data-analyst',
        departmentId: 'data',
        salaryAmountMinor: 100_000_000,
      };
      expect(
        (await send(globalHr, 'post', '/api/employees', { ...base, hireDate: '2027-06-01' }))
          .status,
      ).toBe(400);
      const huge = await send(globalHr, 'post', '/api/employees', {
        ...base,
        hireDate: '2026-11-02',
        salaryAmountMinor: Number.MAX_SAFE_INTEGER,
      });
      expect(huge.status).toBe(400);
      const someone = await employeeIn('IN');
      const leaving = await send(globalHr, 'post', `/api/employees/${someone.id}/terminate`, {
        terminationDate: '2027-01-31',
        reason: 'resignation',
        version: someone.version,
      });
      expect(leaving.status).toBe(400);
      expect(leaving.body.error.details[0].path).toBe('terminationDate');
    });

    it('answers 404 for an id that is not a uuid', async () => {
      expect((await globalHr.get('/api/employees/not-a-uuid')).status).toBe(404);
    });

    it('refuses to create an employee in a country outside the scope', async () => {
      const res = await send(indiaHr, 'post', '/api/employees', {
        firstName: 'Out',
        lastName: 'Of Scope',
        email: 'out.of.scope@acme.test',
        country: 'GB',
        jobTitleId: 'data-analyst',
        departmentId: 'data',
        hireDate: '2026-11-02',
        salaryAmountMinor: 5_000_000,
      });
      expect(res.status).toBe(403);
    });

    it('requires one country to sort by salary', async () => {
      expect((await globalHr.get('/api/employees?sort=-salary')).status).toBe(400);
      const res = await globalHr.get('/api/employees?sort=-salary&country=IN&pageSize=5');
      const amounts = pageSchema(employeeSchema)
        .parse(res.body)
        .items.map((e) => e.salary.amountMinor);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    });

    it('rejects unknown keys such as currency on create', async () => {
      const res = await send(globalHr, 'post', '/api/employees', {
        firstName: 'A',
        lastName: 'B',
        email: 'a.b@acme.test',
        country: 'IN',
        jobTitleId: 'data-analyst',
        departmentId: 'data',
        hireDate: '2026-11-02',
        salaryAmountMinor: 100,
        currency: 'USD',
      });
      expect(res.status).toBe(400);
    });

    it('creates, edits, changes pay and terminates with optimistic concurrency and an audit trail', async () => {
      const created = await send(indiaHr, 'post', '/api/employees', {
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'Asha.Rao.Test@acme.test',
        country: 'IN',
        jobTitleId: 'data-analyst',
        departmentId: 'data',
        hireDate: '2026-11-02',
        salaryAmountMinor: 180_000_000,
      });
      expect(created.status, created.text).toBe(201);
      const employee = employeeSchema.parse(created.body);
      expect(employee.email).toBe('asha.rao.test@acme.test');
      expect(employee.salary).toEqual({ amountMinor: 180_000_000, currency: 'INR' });
      expect(employee.employeeCode).toMatch(/^ACM-\d{6}$/);
      expect(created.headers.location).toBe(`/api/employees/${employee.id}`);

      const dupe = await send(indiaHr, 'post', '/api/employees', {
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'asha.rao.test@acme.test',
        country: 'IN',
        jobTitleId: 'data-analyst',
        departmentId: 'data',
        hireDate: '2026-11-02',
        salaryAmountMinor: 1,
      });
      expect(dupe.status).toBe(409);

      const edited = await send(indiaHr, 'patch', `/api/employees/${employee.id}`, {
        jobTitleId: 'software-engineer',
        version: 1,
      });
      expect(employeeSchema.parse(edited.body).version).toBe(2);
      const stale = await send(indiaHr, 'patch', `/api/employees/${employee.id}`, {
        lastName: 'R',
        version: 1,
      });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe('stale_version');
      const payViaPatch = await send(indiaHr, 'patch', `/api/employees/${employee.id}`, {
        salaryAmountMinor: 1,
        version: 2,
      });
      expect(payViaPatch.status).toBe(400);

      const tooEarly = await send(indiaHr, 'post', `/api/employees/${employee.id}/salary-changes`, {
        amountMinor: 190_000_000,
        effectiveDate: '2026-10-01',
        reason: 'annual_review',
        version: 2,
      });
      expect(tooEarly.status).toBe(400);
      const future = await send(indiaHr, 'post', `/api/employees/${employee.id}/salary-changes`, {
        amountMinor: 190_000_000,
        effectiveDate: '2026-12-01',
        reason: 'annual_review',
        version: 2,
      });
      expect(future.status).toBe(400);
      const changed = await send(indiaHr, 'post', `/api/employees/${employee.id}/salary-changes`, {
        amountMinor: 198_000_000,
        effectiveDate: '2026-11-15',
        reason: 'market_adjustment',
        note: 'Benchmark',
        version: 2,
      });
      expect(changed.status, changed.text).toBe(201);
      const result = createSalaryChangeResponseSchema.parse(changed.body);
      expect(result.salaryChange.previousAmount).toEqual({
        amountMinor: 180_000_000,
        currency: 'INR',
      });
      expect(result.employee.salary.amountMinor).toBe(198_000_000);
      expect(result.employee.version).toBe(3);

      const history = salaryHistoryResponseSchema.parse(
        (await indiaHr.get(`/api/employees/${employee.id}/salary-changes`)).body,
      );
      expect(history.items.map((h) => h.reason)).toEqual(['market_adjustment', 'hire']);

      const left = await send(indiaHr, 'post', `/api/employees/${employee.id}/terminate`, {
        terminationDate: '2026-11-20',
        reason: 'resignation',
        version: 3,
      });
      expect(employeeSchema.parse(left.body).status).toBe('terminated');
      const twice = await send(indiaHr, 'post', `/api/employees/${employee.id}/terminate`, {
        terminationDate: '2026-11-20',
        reason: 'resignation',
        version: 4,
      });
      expect(twice.status).toBe(409);
      const editLeaver = await send(indiaHr, 'patch', `/api/employees/${employee.id}`, {
        lastName: 'R',
        version: 4,
      });
      expect(editLeaver.status).toBe(409);

      const audit = cursorPageSchema(auditEventSchema).parse(
        (await indiaHr.get(`/api/audit-events?entityType=employee&entityId=${employee.id}`)).body,
      );
      expect(audit.items.map((a) => a.action)).toEqual([
        'employee.terminated',
        'salary.changed',
        'employee.updated',
        'employee.created',
      ]);
      expect(audit.items[2]!.before).toEqual({ jobTitleId: 'data-analyst' });
      expect(audit.items[2]!.after).toEqual({ jobTitleId: 'software-engineer' });
    });

    it('pages the audit log with a cursor and no duplicates', async () => {
      const seen = new Set<string>();
      let cursor: string | null = null;
      let pages = 0;
      do {
        const query: string = cursor ? `&cursor=${cursor}` : '';
        const page = cursorPageSchema(auditEventSchema).parse(
          (await globalHr.get(`/api/audit-events?limit=2${query}`)).body,
        );
        for (const item of page.items) {
          expect(seen.has(item.id)).toBe(false);
          seen.add(item.id);
        }
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor && pages < 50);
      expect(seen.size).toBeGreaterThan(3);
    });

    it('exports CSV with formula cells neutralised and an audit row', async () => {
      await send(globalHr, 'post', '/api/employees', {
        firstName: '=HYPERLINK("x")',
        lastName: 'Formula',
        email: 'formula@acme.test',
        country: 'DE',
        jobTitleId: 'data-analyst',
        departmentId: 'data',
        hireDate: '2026-11-02',
        salaryAmountMinor: 6_000_000,
      });
      const res = await globalHr.get('/api/employees/export.csv?country=DE&q=formula');
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain(`"'=HYPERLINK(""x"")"`);
      expect(res.text).toContain('60000.00,EUR');
      const audit = cursorPageSchema(auditEventSchema).parse(
        (await globalHr.get('/api/audit-events?action=export.created&limit=1')).body,
      );
      expect(audit.items[0]?.action).toBe('export.created');
    });
  });

  describe('insights', () => {
    it('overview counts the same people as the list', async () => {
      const overview = insightsOverviewSchema.parse(
        (await globalHr.get('/api/insights/overview')).body,
      );
      const list = pageSchema(employeeSchema).parse(
        (await globalHr.get('/api/employees?pageSize=1')).body,
      );
      expect(overview.total.headcount).toBe(list.total);
      expect(overview.fx.indicative).toBe(true);
      for (const c of overview.countries) {
        expect(c.minMinor).toBeLessThanOrEqual(c.medianMinor);
        expect(c.medianMinor).toBeLessThanOrEqual(c.maxMinor);
      }
    });

    it('limits Country HR to their countries', async () => {
      const overview = insightsOverviewSchema.parse(
        (await indiaHr.get('/api/insights/overview')).body,
      );
      expect(overview.countries.map((c) => c.country)).toEqual(['IN']);
      expect((await indiaHr.get('/api/insights/by-title?country=GB')).status).toBe(403);
    });

    it('serves by-title, title comparison and a distribution that adds up', async () => {
      const byTitle = insightsByTitleSchema.parse(
        (await globalHr.get('/api/insights/by-title?country=IN')).body,
      );
      const headcount = byTitle.rows.reduce((sum, r) => sum + r.headcount, 0);
      const dist = salaryDistributionSchema.parse(
        (await globalHr.get('/api/insights/distribution?country=IN&buckets=9')).body,
      );
      expect(dist.buckets).toHaveLength(9);
      expect(dist.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(headcount);
      titleComparisonSchema.parse((await globalHr.get('/api/insights/titles/data-analyst')).body);
      expect((await globalHr.get('/api/insights/titles/nope')).status).toBe(404);
    });
  });

  describe('imports', () => {
    it('uploads, dry-runs, commits and undoes a CSV', async () => {
      const existing = employeeSchema.parse(
        (await globalHr.get(`/api/employees/${(await employeeIn('IN')).id}`)).body,
      );
      const csv = [
        'Emp ID,Name,Surname,E-mail,Role,Dept,Annual CTC,DOJ,Country',
        `${existing.employeeCode},${existing.firstName},${existing.lastName},${existing.email},Engineering Manager,${existing.department.name},"99,00,000",${existing.hireDate},IN`,
        ',Neha,Kapoor,neha.kapoor.import@acme.test,Data Analyst,Data,1600000,2026-11-03,IN',
        ',Bad,Row,not-an-email,Nope,Data,abc,2026-13-01,IN',
        ',Tom,Smith,tom.smith.import@acme.test,Data Analyst,Data,50000,2026-11-03,GB',
      ].join('\n');
      const uploaded = await indiaHr
        .post('/api/imports')
        .set('Origin', ORIGIN)
        .attach('file', Buffer.from(csv), { filename: 'india.csv', contentType: 'text/csv' });
      expect(uploaded.status, uploaded.text).toBe(201);
      const upload = importUploadResponseSchema.parse(uploaded.body);
      expect(upload.suggestedMapping).toMatchObject({
        employeeCode: 'Emp ID',
        firstName: 'Name',
        lastName: 'Surname',
        salaryAmount: 'Annual CTC',
        hireDate: 'DOJ',
      });

      const mapped = await send(indiaHr, 'put', `/api/imports/${upload.id}/mapping`, {
        mapping: {
          ...upload.suggestedMapping,
          jobTitle: 'Role',
          department: 'Dept',
          email: 'E-mail',
          country: 'Country',
        },
        defaults: { salaryEffectiveDate: '2026-11-01' },
      });
      expect(mapped.status, mapped.text).toBe(200);
      expect(importSchema.parse(mapped.body).summary).toEqual({
        rows: 4,
        create: 1,
        update: 1,
        unchanged: 0,
        error: 2,
      });

      const errors = pageSchema(importRowSchema).parse(
        (await indiaHr.get(`/api/imports/${upload.id}/rows?outcome=error`)).body,
      );
      expect(errors.items.map((r) => r.rowNumber)).toEqual([4, 5]);
      // Rows carry the person's name (the file's for new rows) and country for the review.
      expect(errors.items.map((r) => r.employeeName)).toEqual(['Bad Row', 'Tom Smith']);
      const updates = pageSchema(importRowSchema).parse(
        (await indiaHr.get(`/api/imports/${upload.id}/rows?outcome=update`)).body,
      );
      expect(updates.items[0]).toMatchObject({
        employeeCode: existing.employeeCode,
        employeeName: `${existing.firstName} ${existing.lastName}`,
        countryCode: 'IN',
      });
      expect(errors.items[1]!.errors[0]!.message).toMatch(/outside your countries/);
      const report = await indiaHr.get(`/api/imports/${upload.id}/rows.csv?outcome=error`);
      expect(report.text).toContain('Problems');

      expect(
        (
          await send(indiaHr, 'post', `/api/imports/${upload.id}/commit`, {
            skipInvalidRows: false,
          })
        ).status,
      ).toBe(400);
      const committed = await send(indiaHr, 'post', `/api/imports/${upload.id}/commit`, {
        skipInvalidRows: true,
      });
      expect(committed.status, committed.text).toBe(200);
      expect(importSchema.parse(committed.body).status).toBe('committed');
      expect(
        (await send(indiaHr, 'post', `/api/imports/${upload.id}/commit`, { skipInvalidRows: true }))
          .status,
      ).toBe(409);

      const after = employeeSchema.parse(
        (await globalHr.get(`/api/employees/${existing.id}`)).body,
      );
      expect(after.jobTitle.id).toBe('engineering-manager');
      expect(after.salary.amountMinor).toBe(990_000_000);
      const neha = pageSchema(employeeSchema).parse(
        (await globalHr.get('/api/employees?q=neha.kapoor.import')).body,
      );
      expect(neha.total).toBe(1);

      // Only the uploader can change an import; RLS hides it from anyone else's writes (404).
      expect((await send(globalHr, 'post', `/api/imports/${upload.id}/undo`)).status).toBe(404);

      const undone = await send(indiaHr, 'post', `/api/imports/${upload.id}/undo`);
      expect(undone.status, undone.text).toBe(200);
      const restored = employeeSchema.parse(
        (await globalHr.get(`/api/employees/${existing.id}`)).body,
      );
      expect(restored.jobTitle.id).toBe(existing.jobTitle.id);
      expect(restored.salary.amountMinor).toBe(existing.salary.amountMinor);
      expect(
        pageSchema(employeeSchema).parse(
          (await globalHr.get('/api/employees?q=neha.kapoor.import')).body,
        ).total,
      ).toBe(0);
    });

    it('blocks undo once someone else changed an imported employee', async () => {
      const csv =
        'First name,Last name,Email,Country,Job title,Department,Hire date,Salary\nLina,Weber,lina.weber.import@acme.test,DE,Data Analyst,Data,2026-11-03,60000\n';
      const upload = importUploadResponseSchema.parse(
        (
          await globalHr
            .post('/api/imports')
            .set('Origin', ORIGIN)
            .attach('file', Buffer.from(csv), { filename: 'de.csv', contentType: 'text/csv' })
        ).body,
      );
      await send(globalHr, 'put', `/api/imports/${upload.id}/mapping`, {
        mapping: upload.suggestedMapping,
      });
      expect(
        (
          await send(globalHr, 'post', `/api/imports/${upload.id}/commit`, {
            skipInvalidRows: false,
          })
        ).status,
      ).toBe(200);
      const lina = pageSchema(employeeSchema).parse(
        (await globalHr.get('/api/employees?q=lina.weber.import')).body,
      ).items[0]!;
      await send(globalHr, 'patch', `/api/employees/${lina.id}`, {
        lastName: 'Weber-Schmidt',
        version: lina.version,
      });
      const blocked = await send(globalHr, 'post', `/api/imports/${upload.id}/undo`);
      expect(blocked.status).toBe(409);
    });

    it('serves the template', async () => {
      const res = await globalHr.get('/api/imports/template.xlsx');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    });
  });

  describe('access management', () => {
    it('lists users and roles, and the permission catalogue', async () => {
      const users = usersResponseSchema.parse((await globalHr.get('/api/users')).body);
      expect(users.items.map((u) => u.email)).not.toContain('seed@acme.invalid');
      rolesResponseSchema.parse((await globalHr.get('/api/roles')).body);
      expect(
        permissionCatalogueSchema.parse((await globalHr.get('/api/permissions')).body).items,
      ).toHaveLength(11);
    });

    it('enforces permission dependencies and protects system roles', async () => {
      const missing = await send(globalHr, 'post', '/api/roles', {
        name: 'Broken',
        countryScope: 'all',
        permissions: ['ai:ask'],
      });
      expect(missing.status).toBe(400);

      const created = await send(globalHr, 'post', '/api/roles', {
        name: 'Finance viewer',
        countryScope: 'all',
        permissions: ['employees:read', 'insights:read'],
      });
      expect(created.status, created.text).toBe(201);
      const role = roleSchema.parse(created.body);
      expect(role.key).toBe('finance_viewer');

      const renamed = await send(globalHr, 'patch', `/api/roles/${role.id}`, {
        description: 'Read-only',
        version: role.version,
      });
      expect(roleSchema.parse(renamed.body).version).toBe(2);

      const roles = rolesResponseSchema.parse((await globalHr.get('/api/roles')).body).items;
      const globalRole = roles.find((r) => r.key === 'global_hr')!;
      expect(
        (
          await send(globalHr, 'patch', `/api/roles/${globalRole.id}`, {
            name: 'Boss',
            version: globalRole.version,
          })
        ).status,
      ).toBe(409);
      expect((await send(globalHr, 'delete', `/api/roles/${globalRole.id}`)).status).toBe(409);
      expect((await send(globalHr, 'delete', `/api/roles/${role.id}`)).status).toBe(204);
    });

    it('invites a user who accepts and signs in, then deactivation ends their access', async () => {
      const roles = rolesResponseSchema.parse((await globalHr.get('/api/roles')).body).items;
      const countryHr = roles.find((r) => r.key === 'country_hr')!;
      const noCountries = await send(globalHr, 'post', '/api/users', {
        name: 'New HR',
        email: 'new.hr@acme.test',
        roleId: countryHr.id,
        countries: [],
      });
      expect(noCountries.status).toBe(400);

      const invited = await send(globalHr, 'post', '/api/users', {
        name: 'New HR',
        email: 'New.HR@acme.test',
        roleId: countryHr.id,
        countries: ['SG'],
      });
      expect(invited.status, invited.text).toBe(201);
      const { user, inviteUrl } = inviteUserResponseSchema.parse(invited.body);
      expect(user.status).toBe('invited');
      const token = new URL(inviteUrl).hash.replace('#token=', '');

      const info = inviteInfoSchema.parse(
        (await request(app).get(`/api/auth/invites/${token}`)).body,
      );
      expect(info).toEqual({ email: 'new.hr@acme.test', name: 'New HR', isReset: false });
      const weak = await request(app)
        .post('/api/auth/accept-invite')
        .set('Origin', ORIGIN)
        .send({ token, password: 'short' });
      expect(weak.status).toBe(400);

      const newHr = request.agent(app);
      const accepted = await newHr
        .post('/api/auth/accept-invite')
        .set('Origin', ORIGIN)
        .send({ token, password: 'a long enough password' });
      expect(accepted.status, accepted.text).toBe(200);
      expect(meSchema.parse(accepted.body).countries).toEqual(['SG']);
      expect((await request(app).get(`/api/auth/invites/${token}`)).status).toBe(404);
      expect((await newHr.get('/api/employees?pageSize=1')).status).toBe(200);

      const deactivated = await send(globalHr, 'post', `/api/users/${user.id}/deactivate`);
      expect(deactivated.body.status).toBe('deactivated');
      expect((await newHr.get('/api/auth/me')).status).toBe(401);

      const access = cursorPageSchema(auditEventSchema).parse(
        (await globalHr.get('/api/audit-events?entityType=user&limit=5')).body,
      );
      expect(access.items.map((a) => a.action)).toEqual(
        expect.arrayContaining(['user.deactivated', 'user.invited']),
      );
    });

    it('stops people from changing their own role or removing the last Global HR', async () => {
      const me = meSchema.parse((await globalHr.get('/api/auth/me')).body);
      const users = usersResponseSchema.parse((await globalHr.get('/api/users')).body).items;
      const self = users.find((u) => u.id === me.id)!;
      const roles = rolesResponseSchema.parse((await globalHr.get('/api/roles')).body).items;
      const countryHr = roles.find((r) => r.key === 'country_hr')!;
      expect(
        (
          await send(globalHr, 'patch', `/api/users/${self.id}`, {
            roleId: countryHr.id,
            countries: ['IN'],
            version: self.version,
          })
        ).status,
      ).toBe(409);
      expect((await send(globalHr, 'post', `/api/users/${self.id}/deactivate`)).status).toBe(409);
    });
  });
});
