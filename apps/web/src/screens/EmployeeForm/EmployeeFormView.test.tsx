import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sampleMeta, samplePriya } from '../../stories/screenSampleData';
import { todayIso } from '../../lib/format';
import { render, screen } from '../../test/render';
import { EmployeeFormView, type EmployeeFormViewProps } from './EmployeeFormView';

const props = (overrides: Partial<EmployeeFormViewProps> = {}): EmployeeFormViewProps => ({
  countries: sampleMeta.countries,
  departments: sampleMeta.departments,
  jobTitles: sampleMeta.jobTitles,
  cancelHref: '/employees',
  onSubmit: vi.fn(),
  ...overrides,
});

describe('EmployeeFormView', () => {
  it('validates a new employee before submitting', async () => {
    const onSubmit = vi.fn();
    render(<EmployeeFormView {...props({ onSubmit })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save employee' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/First name/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains each missing field in plain words, not schema messages', async () => {
    render(<EmployeeFormView {...props()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save employee' }));
    for (const message of [
      'Enter a first name',
      'Enter a last name',
      'Enter a work email',
      'Choose a department',
      'Choose a job title',
      'Choose a country',
      'Enter the annual salary',
    ]) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Too small|Expected|Invalid input/)).not.toBeInTheDocument();
  });

  it('only accepts hire dates up to today', async () => {
    render(<EmployeeFormView {...props()} />);

    const hireDate = screen.getByLabelText(/Hire date/);
    expect(hireDate).toHaveAttribute('max', todayIso());
    await userEvent.clear(hireDate);
    await userEvent.type(hireDate, '2999-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Save employee' }));
    expect(screen.getByText('Choose today or an earlier date')).toBeInTheDocument();
  });

  it('sends only the changed fields with the version when editing', async () => {
    const onSubmit = vi.fn();
    render(<EmployeeFormView {...props({ employee: samplePriya, onSubmit })} />);

    const lastName = screen.getByLabelText(/Last name/);
    await userEvent.clear(lastName);
    await userEvent.type(lastName, 'Verma');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSubmit).toHaveBeenCalledWith({
      mode: 'edit',
      body: { lastName: 'Verma', version: samplePriya.version },
    });
  });

  it('says when nothing changed', async () => {
    const onSubmit = vi.fn();
    render(<EmployeeFormView {...props({ employee: samplePriya, onSubmit })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Not saved' })).toBeInTheDocument();
  });

  it('shows server field errors', () => {
    render(<EmployeeFormView {...props({ serverErrors: { email: 'Already used' } })} />);

    expect(screen.getByText('Already used')).toBeInTheDocument();
  });
});
