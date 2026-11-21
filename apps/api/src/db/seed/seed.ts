import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { hash } from '@node-rs/argon2';
import { count, eq, sql } from 'drizzle-orm';
import { createDb, describeError, requireEnv, type Db } from '../database.js';
import {
  auditEvents,
  employees,
  importRows,
  imports,
  roles,
  salaryChanges,
  userCountries,
  users,
} from '../schema/index.js';
import { generateSeedData } from './generate.js';

/** Owns every row the seed writes, so it is never mistaken for a real person's change. */
export const SEED_USER_EMAIL = 'seed@acme.invalid';

/** Demo sign-ins from docs/auth.md, "Bootstrap and demo accounts". */
const DEMO_USERS = [
  { email: 'global.hr@demo.acme.test', name: 'Global HR (demo)', role: 'global_hr', countries: [] },
  {
    email: 'india.hr@demo.acme.test',
    name: 'India HR (demo)',
    role: 'country_hr',
    countries: ['IN'],
  },
  {
    email: 'uk-us.hr@demo.acme.test',
    name: 'UK and US HR (demo)',
    role: 'country_hr',
    countries: ['GB', 'US'],
  },
] as const;

/** Rows per insert, well under Postgres's 65,535 parameters per statement. */
const INSERT_BATCH = 1_000;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface SeedOptions {
  employees: number;
  seed: number;
  asOf: string;
  reset: boolean;
  /** Set to create the demo users; needs `demoPassword`. */
  demoUsers: boolean;
  demoPassword?: string;
  log?: (message: string) => void;
}

async function roleId(tx: Tx, key: string): Promise<string> {
  const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
  if (!role) throw new Error(`Role "${key}" is missing. Run "npm run db:migrate" first.`);
  return role.id;
}

async function upsertSeedUser(tx: Tx): Promise<string> {
  // Deactivated, with no password: it can never sign in.
  const [user] = await tx
    .insert(users)
    .values({
      email: SEED_USER_EMAIL,
      name: 'Seed data',
      roleId: await roleId(tx, 'global_hr'),
      status: 'deactivated',
      deactivatedAt: new Date(),
    })
    .onConflictDoUpdate({ target: users.email, set: { name: 'Seed data' } })
    .returning({ id: users.id });
  return user!.id;
}

async function upsertDemoUsers(tx: Tx, password: string, createdBy: string): Promise<void> {
  const passwordHash = await hash(password);
  for (const demo of DEMO_USERS) {
    const values = {
      email: demo.email,
      name: demo.name,
      roleId: await roleId(tx, demo.role),
      status: 'active' as const,
      passwordHash,
      deactivatedAt: null,
      failedSignIns: 0,
      lockedUntil: null,
    };
    const [user] = await tx
      .insert(users)
      .values({ ...values, createdBy })
      .onConflictDoUpdate({ target: users.email, set: values })
      .returning({ id: users.id });
    await tx.delete(userCountries).where(eq(userCountries.userId, user!.id));
    if (demo.countries.length > 0) {
      await tx
        .insert(userCountries)
        .values(demo.countries.map((countryCode) => ({ userId: user!.id, countryCode })));
    }
  }
}

function batches<T>(rows: readonly T[], size = INSERT_BATCH): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < rows.length; start += size)
    result.push(rows.slice(start, start + size));
  return result;
}

/**
 * Fills the database with synthetic employees and salary history, in one transaction. Refuses
 * to add to a database that already has employees unless `reset` is set, which first removes
 * every employee, salary entry, import and audit event.
 */
export async function seedDatabase(db: Db, options: SeedOptions): Promise<void> {
  const log = options.log ?? console.log;
  if (options.demoUsers && !options.demoPassword) {
    throw new Error('SEED_DEMO_USERS=true needs DEMO_PASSWORD to be set.');
  }

  await db.transaction(async (tx) => {
    // Serialise concurrent seeds instead of interleaving them.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('acme-seed'))`);

    const [row] = await tx.select({ existing: count() }).from(employees);
    const existing = row?.existing ?? 0;
    if (existing > 0 && !options.reset) {
      throw new Error(
        `The database already has ${existing} employees. Run with --reset to replace them.`,
      );
    }
    if (options.reset) {
      log('Removing existing employees, salary history, imports and audit events…');
      await tx.delete(auditEvents);
      await tx.delete(salaryChanges);
      await tx.delete(importRows);
      await tx.delete(employees);
      await tx.delete(imports);
    }

    const seedUserId = await upsertSeedUser(tx);
    if (options.demoUsers && options.demoPassword) {
      await upsertDemoUsers(tx, options.demoPassword, seedUserId);
      log(`Demo users ready: ${DEMO_USERS.map((user) => user.email).join(', ')}`);
    }

    const data = generateSeedData({
      employees: options.employees,
      seed: options.seed,
      asOf: options.asOf,
      createdBy: seedUserId,
    });
    log(`Inserting ${data.employees.length} employees…`);
    for (const batch of batches(data.employees)) await tx.insert(employees).values(batch);
    log(`Inserting ${data.salaryChanges.length} salary entries…`);
    for (const batch of batches(data.salaryChanges)) await tx.insert(salaryChanges).values(batch);
  });

  // Fresh statistics so the planner sees the new row counts straight away.
  // Every table, so the planner also knows the small catalogue tables it joins.
  await db.execute(sql`analyze`);
  log('Seed complete.');
}

async function main() {
  const { values } = parseArgs({
    options: {
      employees: { type: 'string', default: '10000' },
      seed: { type: 'string', default: '20261120' },
      'as-of': { type: 'string', default: '2026-11-01' },
      reset: { type: 'boolean', default: false },
    },
  });
  const db = createDb(requireEnv('DATABASE_URL_MIGRATOR'), { max: 1 });
  const started = Date.now();
  try {
    await seedDatabase(db, {
      employees: Number(values.employees),
      seed: Number(values.seed),
      asOf: values['as-of'],
      reset: values.reset,
      demoUsers: process.env.SEED_DEMO_USERS === 'true',
      demoPassword: process.env.DEMO_PASSWORD,
    });
    console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

// Run only as a script, not when a test imports seedDatabase.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
