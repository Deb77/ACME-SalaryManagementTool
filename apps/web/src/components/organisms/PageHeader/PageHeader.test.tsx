import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the page title as the level-1 heading with its description', () => {
    render(<PageHeader title="Employees" description="10,000 people across 8 countries" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Employees' })).toBeInTheDocument();
    expect(screen.getByText('10,000 people across 8 countries')).toBeInTheDocument();
  });

  it('renders page actions', () => {
    render(<PageHeader title="Employees" actions={<button>Add employee</button>} />);

    expect(screen.getByRole('button', { name: 'Add employee' })).toBeInTheDocument();
  });
});
