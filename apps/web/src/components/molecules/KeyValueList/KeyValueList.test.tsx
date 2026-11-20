import { render, screen } from '../../../test/render';
import { describe, expect, it } from 'vitest';
import { KeyValueList } from './KeyValueList';

describe('KeyValueList', () => {
  it('pairs each label with its value in a description list', () => {
    render(
      <KeyValueList
        items={[
          { label: 'Employee code', value: 'ACM-000042' },
          { label: 'Country', value: 'India' },
        ]}
      />,
    );

    const terms = screen.getAllByRole('term');
    const definitions = screen.getAllByRole('definition');
    expect(terms.map((term) => term.textContent)).toEqual(['Employee code', 'Country']);
    expect(definitions.map((definition) => definition.textContent)).toEqual([
      'ACM-000042',
      'India',
    ]);
  });
});
