import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './FilterSelect';

const countries = [
  { value: 'IN', label: 'India' },
  { value: 'GB', label: 'United Kingdom' },
];

describe('FilterSelect', () => {
  it('is a combobox named by its label', () => {
    render(<FilterSelect label="Country" options={countries} value="IN" onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Country' })).toBeInTheDocument();
    expect(screen.getByText('India')).toBeInTheDocument();
  });

  it('reports the chosen option', async () => {
    const onChange = vi.fn();
    render(
      <FilterSelect label="Country" options={countries} value={undefined} onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'Country' }));
    await userEvent.click(await screen.findByRole('option', { name: 'United Kingdom' }));

    expect(onChange).toHaveBeenCalledWith('GB');
  });
});
