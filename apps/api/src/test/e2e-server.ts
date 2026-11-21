import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import { createDb } from '../db/database.js';
import { seedDatabase } from '../db/seed/seed.js';
import { resetAndMigrate } from '../evals/test-db.js';
import { buildServices } from '../services.js';
import { startThrowawayPostgres } from './throwaway-postgres.js';

/**
 * The whole app for the Playwright smoke tests (e2e/): a throwaway Postgres, migrated and
 * seeded with the demo users, and the API serving the built web app on one port. Test-only:
 * the demo password below never reaches a real database.
 */
export const E2E_PASSWORD = 'e2e-demo-password';
const port = Number(process.env.E2E_PORT ?? 4180);
const origin = `http://localhost:${port}`;

const webDist = fileURLToPath(new URL('../../../web/dist', import.meta.url));
if (!existsSync(webDist)) throw new Error('Build the web app first: npm run build -w @acme/web');

const postgres = await startThrowawayPostgres('acme_e2e');
const owner = createDb(postgres.url, { max: 2 });
await resetAndMigrate(owner);
await seedDatabase(owner, {
  employees: 200,
  seed: 11,
  asOf: '2026-11-01',
  reset: true,
  demoUsers: true,
  demoPassword: E2E_PASSWORD,
  log: () => {},
});
await owner.$client.end();

const config: Config = {
  databaseUrl: postgres.url,
  allowedOrigins: [origin],
  appUrl: origin,
  secureCookies: false,
  dbPoolSize: 4,
  authRateLimit: 1000,
};
const services = buildServices(config);
const server = createApp({ webDist, services }).listen(port, () => {
  console.log(`e2e app on ${origin}`);
});

async function shutdown() {
  server.close();
  await services.db.$client.end();
  await postgres.stop();
  process.exit(0);
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
