import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { TrayCard } from './TrayCard';

describe('TrayCard', () => {
  it('is a region named by its title', () => {
    render(<TrayCard title="Salary history">rows</TrayCard>);

    expect(screen.getByRole('region', { name: 'Salary history' })).toHaveTextContent('rows');
  });

  it('renders extra controls and the footer strip', () => {
    render(
      <TrayCard title="Payroll" extra={<button>More</button>} footer="Total $730.2M">
        chart
      </TrayCard>,
    );

    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.getByText('Total $730.2M')).toBeInTheDocument();
  });

  it('can be a complementary aside with a level-3 heading', () => {
    render(
      <TrayCard title="Before you import" as="aside" headingLevel={3}>
        options
      </TrayCard>,
    );

    expect(screen.getByRole('complementary', { name: 'Before you import' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Before you import' }),
    ).toBeInTheDocument();
  });
});
