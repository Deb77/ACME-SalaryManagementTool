import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

/** A /auth/me that answers only when the test says so. */
function pendingSession() {
  let answer: (res: Response) => void = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
  );
  return {
    signedOut: () =>
      answer(
        Response.json(
          { error: { code: 'unauthenticated', message: 'Sign in to continue.' } },
          { status: 401 },
        ),
      ),
  };
}

describe('App', () => {
  it('sends a signed-out user to the sign-in page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'unauthenticated', message: 'Sign in to continue.' } },
          { status: 401 },
        ),
      ),
    );

    window.history.pushState(null, '', '/insights');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/sign-in');
    expect(window.location.search).toBe('?next=%2Finsights');
  });

  it('shows a first-time visitor no app frame while it checks for a session', async () => {
    const session = pendingSession();
    window.history.pushState(null, '', '/');
    render(<App />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading ACME People…');

    session.signedOut();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the app frame while it checks, for someone who signed in on this browser', async () => {
    window.localStorage.setItem('acme.signedIn', '1');
    pendingSession();
    window.history.pushState(null, '', '/');
    render(<App />);

    expect(await screen.findAllByRole('navigation')).not.toHaveLength(0);
  });

  it('forgets the browser was signed in once the session has ended', async () => {
    window.localStorage.setItem('acme.signedIn', '1');
    const session = pendingSession();
    window.history.pushState(null, '', '/');
    render(<App />);

    session.signedOut();
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(window.localStorage.getItem('acme.signedIn')).toBeNull();
  });
});
