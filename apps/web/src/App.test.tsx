import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('asks the user to sign in when the session is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'unauthenticated', message: 'Sign in to continue.' } },
          { status: 401 },
        ),
      ),
    );

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('You are signed out');
  });
});
