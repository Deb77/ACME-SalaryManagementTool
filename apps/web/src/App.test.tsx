import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
});
