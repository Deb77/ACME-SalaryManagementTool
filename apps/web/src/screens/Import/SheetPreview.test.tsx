import { describe, expect, it } from 'vitest';
import { sampleUpload } from '../../stories/screenSampleData';
import { render, screen, within } from '../../test/render';
import { columnLetter } from './Import.utils';
import { SheetPreview } from './SheetPreview';

describe('columnLetter', () => {
  it('names columns as Excel does', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
      'ZZ',
      'AAA',
    ]);
  });
});

describe('SheetPreview', () => {
  it('shows the file as it is, with Excel row numbers', () => {
    render(<SheetPreview upload={sampleUpload} mapping={sampleUpload.suggestedMapping} />);

    const table = screen.getByRole('table', { name: /First 5 of 2,431 rows/ });
    const rows = within(table).getAllByRole('row');
    // The file's header row, then 5 data rows (the A, B, C row is hidden from screen readers).
    expect(rows).toHaveLength(6);
    expect(within(rows[1]!).getByRole('rowheader', { name: '2' })).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('cell', { name: 'Priya' })).toBeInTheDocument();
  });

  it('says which field each column fills, and follows the matches as they change', () => {
    const { rerender } = render(
      <SheetPreview upload={sampleUpload} mapping={sampleUpload.suggestedMapping} />,
    );
    expect(screen.getByRole('columnheader', { name: /^Name → First name$/ })).toBeInTheDocument();

    const withoutFirstName = Object.fromEntries(
      Object.entries(sampleUpload.suggestedMapping).filter(([field]) => field !== 'firstName'),
    );
    rerender(<SheetPreview upload={sampleUpload} mapping={withoutFirstName} />);
    expect(screen.getByRole('columnheader', { name: /^Name Not imported$/ })).toBeInTheDocument();
  });
});
