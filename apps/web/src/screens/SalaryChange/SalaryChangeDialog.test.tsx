import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sampleDraft, sampleMeta } from '../../stories/screenSampleData';
import { render, screen } from '../../test/render';
import { SalaryChangeDialog, type SalaryChangeDialogProps } from './SalaryChangeDialog';

const props = (overrides: Partial<SalaryChangeDialogProps> = {}): SalaryChangeDialogProps => ({
  open: true,
  onClose: vi.fn(),
  employee: {
    name: 'Rohan Gupta',
    employeeCode: 'ACME-00388',
    jobTitle: 'Data Analyst',
    countryName: 'India',
    salary: sampleDraft.currentAmount,
    version: 3,
  },
  reasons: sampleMeta.salaryChangeReasons,
  onSubmit: vi.fn(),
  ...overrides,
});

describe('SalaryChangeDialog', () => {
  it('asks for the new salary before saving', async () => {
    const onSubmit = vi.fn();
    render(<SalaryChangeDialog {...props({ onSubmit })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the new annual salary')).toBeInTheDocument();
  });

  it('prefills an AI draft and sends its id with the version', async () => {
    const onSubmit = vi.fn();
    render(<SalaryChangeDialog {...props({ draft: sampleDraft, onSubmit })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: sampleDraft.proposedAmount.amountMinor,
        effectiveDate: sampleDraft.effectiveDate,
        reason: sampleDraft.reason,
        version: 3,
        aiDraftId: sampleDraft.draftId,
      }),
    );
  });

  it('shows a form-level error', () => {
    render(<SalaryChangeDialog {...props({ error: 'Someone changed this employee.' })} />);

    expect(screen.getByText('Someone changed this employee.')).toBeInTheDocument();
  });
});
