/**
 * The test database's connection string. The suite's global setup always provides one: the
 * TEST_DATABASE_URL you set, or a throwaway Postgres it starts (see global-setup.ts).
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is unset: run the tests through vitest');
  return url;
}
