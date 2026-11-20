import { fileURLToPath } from 'node:url';

// Ladle adds its own React plugin, so this only needs the workspace alias.
export default {
  resolve: {
    alias: {
      '@acme/shared': fileURLToPath(
        new URL('../../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
};
