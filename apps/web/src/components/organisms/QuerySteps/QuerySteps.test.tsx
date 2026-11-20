import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { QuerySteps } from './QuerySteps';

const steps = [
  {
    label: 'Looked up Data Analyst pay',
    query: 'salary_stats(title="Data Analyst")',
    result: '3 rows',
  },
  {
    label: 'Found the lowest paid',
    query: 'list_employees(max_salary=850000)',
    result: '9 people',
  },
];

describe('QuerySteps', () => {
  it('shows each step with the exact query it ran', () => {
    render(<QuerySteps title="Worked through 2 steps" steps={steps} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('salary_stats(title="Data Analyst")')).toBeInTheDocument();
  });

  it('collapses and expands the steps', async () => {
    render(<QuerySteps title="Worked through 2 steps" steps={steps} />);
    const toggle = screen.getByRole('button', { name: 'Hide steps' });

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show steps' }));

    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
