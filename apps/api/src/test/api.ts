import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, expect } from 'vitest';
import type { Express } from 'express';
import { employeeSchema, type Employee } from '@acme/shared';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import { createDb, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed/seed.js';
import { resetAndMigrate } from '../evals/test-db.js';
import type { Clock } from '../lib/clock.js';
import { buildServices, type AppServices } from '../services.js';
import { anEmployee, type EmployeeBuilder } from './builders.js';
import { testDatabaseUrl } from './database.js';

export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'integration-test-password';
export const GLOBAL = 'global.hr@demo.acme.test';
export const INDIA = 'india.hr@demo.acme.test';
export const fixedClock: Clock = { now: () => new Date(), today: () => '2026-11-20' };

export type Agent = ReturnType<typeof request.agent>;
type Method = 'post' | 'patch' | 'put' | 'delete';

/**
 * The HTTP API against a real Postgres with row-level security on, wired exactly as the server
 * is. Each test file calls `useTestApi()` once: it gets a freshly migrated and seeded database
 * of its own, so no file depends on what another did.
 */
export class TestApi {
  owner!: Db;
  services!: AppServices;
  app!: Express;
  /** Signed in as Global HR (every country) and India HR (India only). */
  globalHr!: Agent;
  indiaHr!: Agent;

  async signIn(email: string, password = PASSWORD): Promise<Agent> {
    const agent = request.agent(this.app);
    const res = await agent
      .post('/api/auth/sign-in')
      .set('Origin', ORIGIN)
      .send({ email, password });
    expect(res.status, res.text).toBe(200);
    return agent;
  }

  /** A state-changing request from the app's own origin (the CSRF check wants one). */
  send(agent: Agent, method: Method, path: string, body?: object) {
    return agent[method](path).set('Origin', ORIGIN).send(body);
  }

  /** Creates the employee through the API (as India HR unless told otherwise). */
  async hire(
    employee: EmployeeBuilder = anEmployee(),
    as: Agent = this.indiaHr,
  ): Promise<Employee> {
    const res = await this.send(as, 'post', '/api/employees', employee.build());
    expect(res.status, res.text).toBe(201);
    return employeeSchema.parse(res.body);
  }

  /** A seeded active employee in `country`, read past RLS. */
  async employeeIn(country: string): Promise<{ id: string; version: number }> {
    const { rows } = await this.owner.execute<{ id: string; version: number }>(
      sql`select id, version from employees where country_code = ${country} and status = 'active' order by employee_code limit 1`,
    );
    return rows[0]!;
  }

  async start(employees: number): Promise<void> {
    const url = testDatabaseUrl();
    this.owner = createDb(url, { max: 2 });
    await resetAndMigrate(this.owner);
    await seedDatabase(this.owner, {
      employees,
      seed: 11,
      asOf: '2026-11-01',
      reset: true,
      demoUsers: true,
      demoPassword: PASSWORD,
      log: () => {},
    });
    const config: Config = {
      databaseUrl: url,
      allowedOrigins: [ORIGIN],
      appUrl: ORIGIN,
      secureCookies: false,
      dbPoolSize: 4,
      authRateLimit: 1000,
    };
    this.services = buildServices(config, {
      clock: fixedClock,
      logger: { error: () => {}, info: () => {} },
    });
    this.app = createApp({ services: this.services });
    this.globalHr = await this.signIn(GLOBAL);
    this.indiaHr = await this.signIn(INDIA);
  }

  async stop(): Promise<void> {
    await this.services?.db.$client.end();
    await this.owner?.$client.end();
  }
}

/** Starts a test API with its own seeded database for this file, and stops it afterwards. */
export function useTestApi({ employees = 200 } = {}): TestApi {
  const api = new TestApi();
  beforeAll(() => api.start(employees), 120_000);
  afterAll(() => api.stop());
  return api;
}
