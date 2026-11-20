import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme/fonts';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

/**
 * In development the API is mocked in the browser (MSW) unless `VITE_MOCK_API=false`.
 * `import.meta.env.DEV` is a build-time constant, so the whole branch, and the `./mocks`
 * chunk with it, is dropped from production bundles.
 */
async function startMocksIfEnabled() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK_API !== 'false') {
    const { startMockApi } = await import('./mocks/browser');
    await startMockApi();
  }
}

startMocksIfEnabled()
  .catch((error: unknown) => console.error('[mock api] failed to start', error))
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
