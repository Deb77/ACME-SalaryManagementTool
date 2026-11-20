import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceChips } from './ChoiceChips';

const options = [
  { value: 'US', label: 'United States', detail: '2,980' },
  { value: 'CA', label: 'Canada', detail: '720' },
  { value: 'IN', label: 'India', disabled: true },
];

describe('ChoiceChips', () => {
  it('is a group of checkboxes named by the legend', () => {
    render(<ChoiceChips legend="Countries" options={options} value={['US']} onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Countries' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /United States/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Canada/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /India/ })).toBeDisabled();
  });

  it('adds a value in option order and removes it again', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ChoiceChips legend="Countries" options={options} value={['CA']} onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: /United States/ }));
    expect(onChange).toHaveBeenLastCalledWith(['US', 'CA']);

    rerender(
      <ChoiceChips legend="Countries" options={options} value={['US', 'CA']} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /Canada/ }));
    expect(onChange).toHaveBeenLastCalledWith(['US']);
  });

  it('shows an error instead of the hint', () => {
    render(
      <ChoiceChips
        legend="Countries"
        options={options}
        value={[]}
        onChange={vi.fn()}
        hint="Pick at least one"
        error="Choose a country"
      />,
    );

    expect(screen.getByText('Choose a country')).toBeInTheDocument();
    expect(screen.queryByText('Pick at least one')).not.toBeInTheDocument();
  });
});
