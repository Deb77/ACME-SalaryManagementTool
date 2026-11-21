import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { QuerySteps } from './QuerySteps';

const steps = [
  {
    label: 'Looked up Data Analyst pay',
    result: '3 rows',
  },
  {
    label: 'Found the lowest paid',
    result: '9 people',
  },
];

describe('QuerySteps', () => {
  it('shows each step in plain English with its outcome', () => {
    render(<QuerySteps title="Worked through 2 steps" steps={steps} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Looked up Data Analyst pay')).toBeInTheDocument();
    expect(screen.getByText('9 people')).toBeInTheDocument();
  });

  it('always shows the steps, with nothing to open or close', () => {
    render(<QuerySteps title="Worked through 2 steps" steps={steps} />);

    expect(screen.getByRole('list')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
