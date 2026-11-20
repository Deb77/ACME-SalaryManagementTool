import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('explains the empty result and offers the next step', () => {
    render(
      <EmptyState
        title="No employees match these filters"
        description="Try removing a filter."
        action={<button>Clear filters</button>}
      />,
    );

    expect(screen.getByText('No employees match these filters')).toBeInTheDocument();
    expect(screen.getByText('Try removing a filter.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });
});
