import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('announces what is loading as a polite status', () => {
    render(<LoadingState label="Loading salary history…" />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading salary history…');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
