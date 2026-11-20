/**
 * Starts the mock API in the browser (dev only; `main.tsx` imports this lazily behind
 * `import.meta.env.DEV`, so it never reaches the production bundle).
 *
 * The signed-in user comes from `?as=global_hr|country_hr|readonly` once, then sessionStorage.
 */
import { getResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import { createRoot } from 'react-dom/client';
import { API_BASE } from '../api/client';
import { configureMockApi } from './config';
import { handlers } from './handlers';
import { MockPill } from './MockPill';
import {
  DEFAULT_MOCK_USER,
  isMockUserKey,
  mockUserLabels,
  setMockUser,
  type MockUserKey,
} from './mockUser';

const STORAGE_KEY = 'acme.mockUser';

/** Reads `?as=` (and removes it from the address bar) or falls back to the remembered user. */
export function resolveMockUser(): MockUserKey {
  const url = new URL(window.location.href);
  const requested = url.searchParams.get('as');
  if (requested !== null) {
    url.searchParams.delete('as');
    window.history.replaceState(window.history.state, '', url);
  }
  if (isMockUserKey(requested)) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, requested);
    } catch {
      // Private mode or storage disabled: the choice lasts for this page load only.
    }
    return requested;
  }
  try {
    const remembered = window.sessionStorage.getItem(STORAGE_KEY);
    if (isMockUserKey(remembered)) return remembered;
  } catch {
    // ignore
  }
  return DEFAULT_MOCK_USER;
}

/**
 * Some embedded browsers (the Claude desktop preview pane, for one) refuse to register any
 * service worker. The same handlers then answer `/api` calls from a patched `window.fetch`,
 * so the app still works; downloads (CSV export, template) go to the network in that mode.
 */
function interceptFetch() {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    if (new URL(request.url).pathname.startsWith(`${API_BASE}/`)) {
      const response = await getResponse(handlers, request);
      if (response) return response;
    }
    return original(input, init);
  };
}

export async function startMockApi() {
  const user = resolveMockUser();
  setMockUser(user);
  // `?latency=3000` slows every mocked response, to look at loading states; remembered for the tab.
  const latencyParam = new URLSearchParams(window.location.search).get('latency');
  if (latencyParam !== null) sessionStorage.setItem('acme-mock-latency', latencyParam);
  const latencyMs = Number(sessionStorage.getItem('acme-mock-latency') ?? 250) || 0;
  configureMockApi({ latencyMs, streamGapMs: 70 });
  let mode = 'service worker';
  try {
    const worker = setupWorker(...handlers);
    await worker.start({
      onUnhandledRequest: 'bypass',
      quiet: true,
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
  } catch (error) {
    console.warn(
      '[mock api] Service worker unavailable, intercepting fetch in-page instead.',
      error,
    );
    interceptFetch();
    mode = 'in-page fetch';
  }
  console.info(
    `[mock api] Signed in as ${mockUserLabels[user]} (${mode}). Switch with ?as=global_hr|country_hr|readonly; set VITE_MOCK_API=false to use the real API.`,
  );
  mountMockPill(user);
}

function mountMockPill(current: MockUserKey) {
  const host = document.createElement('div');
  host.id = 'mock-api-pill';
  document.body.appendChild(host);
  createRoot(host).render(<MockPill current={current} />);
}
