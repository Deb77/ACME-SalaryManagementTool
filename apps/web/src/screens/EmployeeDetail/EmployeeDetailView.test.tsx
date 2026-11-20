import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { samplePriya, sampleSalaryHistory } from '../../stories/screenSampleData';
import { render, screen } from '../../test/render';
import { EmployeeDetailView, type EmployeeDetailViewProps } from './EmployeeDetailView';

const props = (overrides: Partial<EmployeeDetailViewProps> = {}): EmployeeDetailViewProps => ({
  employee: samplePriya,
  countryName: 'India',
  history: { status: 'success', items: sampleSalaryHistory },
  canChangeSalary: true,
  canEdit: true,
  canTerminate: true,
  onRecordSalaryChange: vi.fn(),
  onTerminate: vi.fn(),
  ...overrides,
});

describe('EmployeeDetailView', () => {
  it('shows the employee and opens the salary change and terminate flows', async () => {
    const onRecordSalaryChange = vi.fn();
    const onTerminate = vi.fn();
    render(<EmployeeDetailView {...props({ onRecordSalaryChange, onTerminate })} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Priya Sharma' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record salary change' }));
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }));
    expect(onRecordSalaryChange).toHaveBeenCalled();
    expect(onTerminate).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Edit details' })).toHaveAttribute(
      'href',
      `/employees/${samplePriya.id}/edit`,
    );
  });

  it('offers no actions to a read-only role', () => {
    render(
      <EmployeeDetailView
        {...props({ canChangeSalary: false, canEdit: false, canTerminate: false })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Record salary change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit details' })).not.toBeInTheDocument();
  });

  it('does not offer salary changes or termination for a terminated employee', () => {
    render(
      <EmployeeDetailView
        {...props({
          employee: {
            ...samplePriya,
            status: 'terminated',
            termination: { date: '2026-10-31', reason: 'resignation', note: null },
          },
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Record salary change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument();
  });

  it('lists salary history', () => {
    render(<EmployeeDetailView {...props()} />);

    expect(screen.getByRole('list', { name: 'Salary history' })).toBeInTheDocument();
  });
});
