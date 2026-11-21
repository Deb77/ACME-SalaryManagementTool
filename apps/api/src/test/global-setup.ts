import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

/** A free local port, so parallel runs and a developer's own Postgres never clash. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Vitest global setup for the API. With TEST_DATABASE_URL set (CI's service, or a developer's
 * own database) it does nothing. Otherwise it starts a throwaway Postgres in a temp directory
 * and points TEST_DATABASE_URL at it before any test file loads, so `npm test` needs no setup
 * and no database test is skipped. The server and its files are removed when the run ends.
 */
export default async function setup() {
  if (process.env.TEST_DATABASE_URL) return;

  const dir = await mkdtemp(join(tmpdir(), 'acme-test-pg-'));
  const port = await freePort();
  const server = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => {},
  });
  await server.initialise();
  await server.start();
  await server.createDatabase('acme_test');
  process.env.TEST_DATABASE_URL = `postgres://postgres:postgres@localhost:${port}/acme_test`;

  return async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  };
}
