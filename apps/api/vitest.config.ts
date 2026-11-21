import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@acme/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  // The database suites reset the same test database, so files run one at a time.
  test: { name: 'api', environment: 'node', fileParallelism: false },
});
