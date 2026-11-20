import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { CheckList } from './CheckList';

describe('CheckList', () => {
  it('states in words whether each item is allowed', () => {
    render(
      <CheckList
        items={[
          { label: 'Record salary changes', allowed: true },
          { label: 'Manage roles', allowed: false },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Allowed: Record salary changes');
    expect(items[1]).toHaveTextContent('Not allowed: Manage roles');
  });
});
