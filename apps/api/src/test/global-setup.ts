import { startThrowawayPostgres } from './throwaway-postgres.js';

/**
 * Vitest global setup for the API. With TEST_DATABASE_URL set (CI's service, or a developer's
 * own database) it does nothing. Otherwise it starts a throwaway Postgres in a temp directory
 * and points TEST_DATABASE_URL at it before any test file loads, so `npm test` needs no setup
 * and no database test is skipped. The server and its files are removed when the run ends.
 */
export default async function setup() {
  if (process.env.TEST_DATABASE_URL) return;
  const postgres = await startThrowawayPostgres('acme_test');
  process.env.TEST_DATABASE_URL = postgres.url;
  return postgres.stop;
}
