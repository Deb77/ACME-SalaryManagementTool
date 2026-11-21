import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { buildServices } from './services.js';

const port = Number(process.env.PORT ?? 3000);

// In production the built web app sits next to the API in the monorepo.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

const services = buildServices(loadConfig());

// Refuse to start when the permission catalogue in the database and in code disagree.
await services.roleService.assertCatalogueMatchesCode();

const server = createApp({ webDist: existsSync(webDist) ? webDist : undefined, services }).listen(
  port,
  () => {
    console.log(`Listening on http://localhost:${port}`);
  },
);

async function shutdown() {
  server.close();
  await services.db.$client.end();
  await services.aiPool?.end();
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
