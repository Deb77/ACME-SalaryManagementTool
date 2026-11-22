import { defineConfig, devices } from '@playwright/test';

const port = 4180;

/**
 * Browser smoke tests over the whole app: the built web app served by the API, on a throwaway
 * seeded Postgres (apps/api/src/test/e2e-server.ts). `npm run test:e2e` builds and starts it.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build -w @acme/web && npx tsx --conditions=development apps/api/src/test/e2e-server.ts`,
    url: `http://localhost:${port}/api/health`,
    env: { E2E_PORT: String(port) },
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
