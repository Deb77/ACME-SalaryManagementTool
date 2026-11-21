import pg from 'pg';
import { describe, expect, it } from 'vitest';

/**
 * `npm test` needs no setup: when TEST_DATABASE_URL is unset, the suite starts a throwaway
 * Postgres, so no database test is ever skipped.
 */
describe('test database', () => {
  it('is always available', async () => {
    const url = process.env.TEST_DATABASE_URL;
    expect(url, 'TEST_DATABASE_URL').toBeTruthy();
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    const { rows } = await client.query<{ version: string }>('show server_version');
    await client.end();
    expect(Number.parseInt(rows[0]!.version, 10)).toBeGreaterThanOrEqual(16);
  });
});
