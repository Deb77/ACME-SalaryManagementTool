import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { MoneyText } from './MoneyText';

describe('MoneyText', () => {
  it('formats minor units in the currency', () => {
    render(<MoneyText amountMinor={324_000_000} currency="INR" />);

    expect(screen.getByText('₹32,40,000')).toBeInTheDocument();
  });

  it('shows a signed change', () => {
    render(<MoneyText amountMinor={26_000_000} currency="INR" signed />);

    expect(screen.getByText('+₹2,60,000')).toBeInTheDocument();
  });

  it('keeps the exact amount as a tooltip when abbreviated', () => {
    render(<MoneyText amountMinor={9_200_000} currency="USD" compact />);

    expect(screen.getByText('$92K')).toHaveAttribute('title', '$92,000');
  });
});
