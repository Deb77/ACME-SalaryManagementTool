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
 * Starts a Postgres in a temp directory with one empty database, for tests only. Returns its
 * connection string and a function that stops it and deletes its files.
 */
export async function startThrowawayPostgres(
  database: string,
): Promise<{ url: string; stop: () => Promise<void> }> {
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
  await server.createDatabase(database);
  return {
    url: `postgres://postgres:postgres@localhost:${port}/${database}`,
    stop: async () => {
      await server.stop();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
