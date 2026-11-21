import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@acme/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    name: 'api',
    environment: 'node',
    // Starts a throwaway Postgres when TEST_DATABASE_URL is unset (see the file).
    globalSetup: ['./src/test/global-setup.ts'],
    // The database suites reset the same test database, so files run one at a time.
    fileParallelism: false,
  },
});
