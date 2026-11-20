import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const periods = [
  { value: '3m', label: '3M' },
  { value: '12m', label: '12M' },
] as const;

describe('SegmentedControl', () => {
  it('is a radio group named by its label with the current option checked', () => {
    render(<SegmentedControl label="Period" options={periods} value="12m" onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Period' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '12M' })).toBeChecked();
  });

  it('reports the chosen option', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Period" options={periods} value="12m" onChange={onChange} />);

    await userEvent.click(screen.getByText('3M'));

    expect(onChange).toHaveBeenCalledWith('3m');
  });
});
