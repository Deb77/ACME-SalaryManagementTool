import { render, screen } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SearchField } from './SearchField';

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <SearchField label="Search employees" value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
}

describe('SearchField', () => {
  it('is a search box named by its label that reports typed text', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search employees' }), 'Priya');

    expect(screen.getByRole('status')).toHaveTextContent('Priya');
  });
});
