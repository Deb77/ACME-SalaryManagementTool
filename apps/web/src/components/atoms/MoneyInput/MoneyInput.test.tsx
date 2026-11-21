import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInput } from './MoneyInput';

function renderInput(onChange = vi.fn(), defaultValueMinor: number | null = null) {
  render(
    <>
      <label htmlFor="salary">New annual salary</label>
      <MoneyInput
        id="salary"
        currency="INR"
        defaultValueMinor={defaultValueMinor}
        onChange={onChange}
      />
    </>,
  );
  return onChange;
}

describe('MoneyInput', () => {
  it('shows the starting amount with the currency grouping', () => {
    renderInput(vi.fn(), 324_000_000);

    expect(screen.getByLabelText('New annual salary')).toHaveValue('32,40,000');
    expect(screen.getByText('INR ₹')).toBeInTheDocument();
  });

  it('reports typed amounts as integer minor units', async () => {
    const onChange = renderInput();

    await userEvent.type(screen.getByLabelText('New annual salary'), '35,00,000');

    expect(onChange).toHaveBeenLastCalledWith(350_000_000);
  });

  it('reports null while the text is not an amount', async () => {
    const onChange = renderInput();

    await userEvent.type(screen.getByLabelText('New annual salary'), '12abc');

    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('regroups the amount when the field loses focus', async () => {
    renderInput();
    const input = screen.getByLabelText('New annual salary');

    await userEvent.type(input, '1200000');
    await userEvent.tab();

    expect(input).toHaveValue('12,00,000');
  });

  it('keeps the hint and error wiring it is given (FormField)', () => {
    render(
      <>
        <MoneyInput
          id="salary"
          currency="INR"
          onChange={vi.fn()}
          aria-describedby="salary-message"
          aria-invalid
        />
        <span id="salary-message">Enter an amount above zero</span>
      </>,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAccessibleDescription('Enter an amount above zero');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the code once when the currency has no symbol of its own', () => {
    render(
      <>
        <label htmlFor="salary">New annual salary</label>
        <MoneyInput id="salary" currency="SGD" onChange={vi.fn()} />
      </>,
    );

    expect(screen.getByText('SGD')).toBeInTheDocument();
    expect(screen.queryByText('SGD SGD')).not.toBeInTheDocument();
  });
});
