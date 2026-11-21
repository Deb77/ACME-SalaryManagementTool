import { and, count, eq, like, ne, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { permissionKeys } from '@acme/shared';
import { createDb, type Db } from './database.js';
import { migrateToLatest } from './migrate.js';
import {
  employees,
  permissions,
  rolePermissions,
  roles,
  salaryChanges,
  userCountries,
  users,
} from './schema/index.js';
import { SEED_USER_EMAIL, seedDatabase } from './seed/seed.js';
import { resetSchema } from '../evals/test-db.js';
import { testDatabaseUrl } from '../test/database.js';

/**
 * Runs the migrations and the seed against a real, throwaway Postgres. The test drops and
 * recreates the public schema, so never point TEST_DATABASE_URL at a database you care about.
 */
const url = testDatabaseUrl();
const quiet = () => {};

describe('database migrations and seed', () => {
  let db: Db;

  beforeAll(async () => {
    db = createDb(url, { max: 2 });
    await resetSchema(db);
    await migrateToLatest(db);
  }, 60_000);

  afterAll(async () => {
    await db?.$client.end();
  });

  it('migrates an empty database, and a second run is a no-op', async () => {
    await migrateToLatest(db);
    const [row] = await db
      .execute<{ count: number }>(
        sql`
      select count(*)::int as count from information_schema.tables where table_schema = 'public'`,
      )
      .then((result) => result.rows);
    expect(row!.count).toBe(20);
  });

  it('seeds the permission catalogue to match the code, and the two system roles', async () => {
    const keys = await db.select({ key: permissions.key }).from(permissions);
    expect(keys.map((p) => p.key).sort()).toEqual([...permissionKeys].sort());

    const grants = await db
      .select({ role: roles.key, count: count() })
      .from(rolePermissions)
      .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
      .groupBy(roles.key)
      .orderBy(roles.key);
    expect(grants).toEqual([
      { role: 'country_hr', count: 9 },
      { role: 'global_hr', count: 11 },
    ]);
  });

  it('seeds employees with history, refuses to seed twice, and reseeds with reset', async () => {
    const options = { employees: 300, seed: 7, asOf: '2026-11-01', demoUsers: false, log: quiet };
    await seedDatabase(db, { ...options, reset: true });

    const [totals] = await db
      .select({
        all: count(),
        active: sql<number>`count(*) filter (where ${employees.status} = 'active')::int`,
      })
      .from(employees);
    expect(totals!.all).toBe(300);
    expect(totals!.active).toBeGreaterThan(270);

    // Every employee's current salary equals their latest history row.
    const mismatched = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from employees e
      join lateral (
        select amount_minor, effective_date from salary_changes s
        where s.employee_id = e.id order by effective_date desc, created_at desc limit 1
      ) latest on true
      where latest.amount_minor <> e.salary_amount_minor
         or latest.effective_date <> e.salary_effective_date`);
    expect(mismatched.rows[0]!.count).toBe(0);

    const [seedUser] = await db
      .select({ status: users.status, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, SEED_USER_EMAIL));
    expect(seedUser).toEqual({ status: 'deactivated', passwordHash: null });

    await expect(seedDatabase(db, { ...options, reset: false })).rejects.toThrow(
      /already has 300 employees/,
    );
    await seedDatabase(db, { ...options, employees: 100, reset: true });
    const [after] = await db.select({ count: count() }).from(employees);
    expect(after!.count).toBe(100);
  }, 60_000);

  it('creates the demo users with hashed passwords and their countries', async () => {
    await seedDatabase(db, {
      employees: 10,
      seed: 7,
      asOf: '2026-11-01',
      reset: true,
      demoUsers: true,
      demoPassword: 'a long demo password',
      log: quiet,
    });
    const demo = await db
      .select({
        email: users.email,
        status: users.status,
        passwordHash: users.passwordHash,
        country: userCountries.countryCode,
      })
      .from(users)
      .leftJoin(userCountries, eq(userCountries.userId, users.id))
      .where(like(users.email, '%@demo.acme.test'))
      .orderBy(users.email, userCountries.countryCode);
    expect(demo.map((u) => [u.email, u.country])).toEqual([
      ['global.hr@demo.acme.test', null],
      ['india.hr@demo.acme.test', 'IN'],
      ['uk-us.hr@demo.acme.test', 'GB'],
      ['uk-us.hr@demo.acme.test', 'US'],
    ]);
    for (const user of demo) {
      expect(user.status).toBe('active');
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    }
  }, 60_000);

  it('enforces the core rules in the database itself', async () => {
    const [employee] = await db.select().from(employees).where(ne(employees.countryCode, 'US'));
    // Currency must follow the country.
    await expect(
      db
        .update(employees)
        .set({ salaryCurrency: 'USD' })
        .where(and(eq(employees.id, employee!.id))),
    ).rejects.toThrow();
    // A history row must name its employee's country.
    const [creator] = await db.select({ id: users.id }).from(users);
    await expect(
      db.insert(salaryChanges).values({
        employeeId: employee!.id,
        countryCode: 'US',
        amountMinor: employee!.salaryAmountMinor + 100,
        previousAmountMinor: employee!.salaryAmountMinor,
        currency: employee!.salaryCurrency,
        effectiveDate: '2026-11-01',
        reason: 'annual_review',
        createdBy: creator!.id,
      }),
    ).rejects.toThrow();
  });

  it('returns no countries from the scope helper outside a scoped transaction', async () => {
    const outside = await db.execute<{ scope: string[] | null }>(
      sql`select app_private.scope_countries() as scope`,
    );
    expect(outside.rows[0]!.scope).toBeNull();

    const inside = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.countries', 'IN,GB', true)`);
      return tx.execute<{ scope: string[] }>(sql`select app_private.scope_countries() as scope`);
    });
    expect(inside.rows[0]!.scope).toEqual(['IN', 'GB']);
  });
});
