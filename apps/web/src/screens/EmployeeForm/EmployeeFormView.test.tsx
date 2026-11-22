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

/** Fills every required field of Add employee; `email` and `hireDate` can be overridden. */
async function fillNewEmployee({ email = 'neha.kulkarni@acme.com', hireDate = '2026-11-03' } = {}) {
  await userEvent.type(screen.getByLabelText(/First name/), 'Neha');
  await userEvent.type(screen.getByLabelText(/Last name/), 'Kulkarni');
  await userEvent.type(screen.getByLabelText(/Work email/), email);
  await userEvent.selectOptions(screen.getByLabelText(/Department/), 'Data');
  await userEvent.selectOptions(screen.getByLabelText(/Job title/), 'Data Analyst');
  await userEvent.selectOptions(screen.getByLabelText(/Country/), 'India');
  const hire = screen.getByLabelText(/Hire date/);
  await userEvent.clear(hire);
  await userEvent.type(hire, hireDate);
  await userEvent.type(screen.getByLabelText(/Annual base salary/), '1950000');
}

describe('EmployeeFormView', () => {
  it('keeps Save off until every required field has a value', async () => {
    const onSubmit = vi.fn();
    render(<EmployeeFormView {...props({ onSubmit })} />);

    const save = screen.getByRole('button', { name: 'Save employee' });
    expect(save).toBeDisabled();
    expect(save).toHaveAttribute('title', 'Fill in every required field to save');

    await fillNewEmployee();
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mode: 'create' }));
  });

  it('keeps Save off when editing until a field changes', async () => {
    render(<EmployeeFormView {...props({ employee: samplePriya })} />);

    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Last name/), 'x');
    expect(save).toBeEnabled();
    await userEvent.type(screen.getByLabelText(/Last name/), '{Backspace}');
    expect(save).toBeDisabled();
  });

  it('turns Save off again when a required field is emptied', async () => {
    render(<EmployeeFormView {...props({ employee: samplePriya })} />);

    const save = screen.getByRole('button', { name: 'Save changes' });
    await userEvent.type(screen.getByLabelText(/Last name/), 'x');
    expect(save).toBeEnabled();
    await userEvent.clear(screen.getByLabelText(/First name/));
    expect(save).toBeDisabled();
  });

  it('only accepts hire dates up to today', async () => {
    render(<EmployeeFormView {...props()} />);

    expect(screen.getByLabelText(/Hire date/)).toHaveAttribute('max', todayIso());
    await fillNewEmployee({ hireDate: '2999-01-01' });
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

  it('shows server field errors', () => {
    render(<EmployeeFormView {...props({ serverErrors: { email: 'Already used' } })} />);

    expect(screen.getByText('Already used')).toBeInTheDocument();
  });

  it('leads to the first error after a failed save', async () => {
    const onSubmit = vi.fn();
    render(<EmployeeFormView {...props({ onSubmit })} />);

    await fillNewEmployee({ email: 'neha.kulkarni' });
    await userEvent.click(screen.getByRole('button', { name: 'Save employee' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter an email address like name@acme.com')).toBeInTheDocument();
    expect(screen.getByLabelText(/Work email/)).toHaveFocus();
  });

  it('focuses a later field when it is the first one in error', async () => {
    render(<EmployeeFormView {...props({ employee: samplePriya })} />);

    const email = screen.getByLabelText(/Work email/);
    await userEvent.clear(email);
    await userEvent.type(email, 'priya.sharma');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByLabelText(/Work email/)).toHaveFocus();
  });

  it('leaves straight away on Cancel when nothing changed', () => {
    render(<EmployeeFormView {...props({ employee: samplePriya, cancelHref: '/employees/1' })} />);

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/employees/1');
  });

  it('asks before discarding unsaved changes', async () => {
    const onCancel = vi.fn();
    render(<EmployeeFormView {...props({ employee: samplePriya, onCancel })} />);

    await userEvent.type(screen.getByLabelText(/Last name/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Last name/)).toHaveValue(`${samplePriya.lastName}x`);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps the median panel in place, with a prompt until a job title and country are chosen', async () => {
    const { rerender } = render(<EmployeeFormView {...props({ benchmark: null })} />);

    expect(screen.getByText('Median pay for the role')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a job title and country to see what ACME pays for it.'),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Job title/), 'Data Analyst');
    expect(screen.getByText('Choose a country to see what ACME pays for it.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/Country/), 'India');
    rerender(<EmployeeFormView {...props({ benchmark: null, benchmarkLoading: true })} />);
    expect(screen.getByText('Loading what ACME pays for this role…')).toBeInTheDocument();

    rerender(
      <EmployeeFormView
        {...props({
          benchmark: {
            jobTitle: 'Data Analyst',
            countryName: 'India',
            currency: 'INR',
            headcount: 42,
            minMinor: 90_000_000,
            medianMinor: 140_000_000,
            maxMinor: 210_000_000,
          },
        })}
      />,
    );
    expect(screen.getByText('Data Analysts in India')).toBeInTheDocument();
    expect(screen.queryByText('Median pay for the role')).not.toBeInTheDocument();
  });

  it('shows no pay guide to people who cannot see insights', () => {
    render(<EmployeeFormView {...props()} />);

    expect(screen.queryByText('Median pay for the role')).not.toBeInTheDocument();
  });
});
