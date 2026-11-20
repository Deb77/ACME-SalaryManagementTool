import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { RoleCard } from './RoleCard';

describe('RoleCard', () => {
  it('is an article named by the role, listing what it allows', () => {
    render(
      <RoleCard
        name="Country HR"
        scope="Only the countries assigned to them"
        badge="Scoped"
        permissions={[
          { label: 'Record salary changes', allowed: true },
          { label: 'Manage roles', allowed: false },
        ]}
        footer="6 people"
        actions={<button>Edit role</button>}
      />,
    );

    const card = screen.getByRole('article', { name: 'Country HR' });
    expect(card).toHaveTextContent('Only the countries assigned to them');
    expect(card).toHaveTextContent('Not allowed: Manage roles');
    expect(card).toHaveTextContent('6 people');
    expect(screen.getByRole('button', { name: 'Edit role' })).toBeInTheDocument();
  });
});
