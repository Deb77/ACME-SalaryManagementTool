import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImportRow } from '@acme/shared';
import {
  sampleImportErrors,
  sampleImportSummary,
  sampleMeta,
  sampleUpload,
} from '../../stories/screenSampleData';
import { render, screen, within } from '../../test/render';
import { ImportView, type ImportViewProps } from './ImportView';

const record = {
  id: sampleUpload.id,
  status: 'validated' as const,
  fileName: sampleUpload.fileName,
  summary: sampleImportSummary,
  createdAt: '2026-11-20T09:00:00.000Z',
};

const props = (overrides: Partial<ImportViewProps> = {}): ImportViewProps => ({
  step: 'upload',
  onFileSelected: vi.fn(),
  onFileRejected: vi.fn(),
  upload: sampleUpload,
  mapping: sampleUpload.suggestedMapping,
  record,
  outcome: 'error',
  onOutcomeChange: vi.fn(),
  rows: { status: 'success', items: sampleImportErrors, total: 6, page: 1, pageSize: 25 },
  onRowsPageChange: vi.fn(),
  onCommit: vi.fn(),
  onStartOver: vi.fn(),
  onUndo: vi.fn(),
  changeContext: {
    countries: sampleMeta.countries,
    jobTitles: sampleMeta.jobTitles,
    departments: sampleMeta.departments,
    updateCurrency: 'INR',
  },
  ...overrides,
});

describe('ImportView', () => {
  it('starts with the upload step and no template to download', () => {
    render(<ImportView {...props()} />);

    expect(screen.getByText('Upload your file')).toBeInTheDocument();
    // People bring the sheet they already use; columns are matched after upload.
    expect(screen.queryByRole('link', { name: /template/i })).not.toBeInTheDocument();
  });

  it('goes from upload straight to review, with no matching step', () => {
    render(<ImportView {...props({ step: 'review' })} />);

    expect(screen.getByRole('list', { name: 'Import progress' })).not.toHaveTextContent(
      /Match columns/,
    );
    expect(screen.queryByRole('button', { name: 'Edit matching' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace file' })).toBeInTheDocument();
  });

  it('shows the file only when Preview file is clicked', async () => {
    render(<ImportView {...props({ step: 'review' })} />);

    expect(screen.queryByRole('region', { name: 'Sheet preview' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Preview file' }));
    const dialog = await screen.findByRole('dialog', { name: sampleUpload.fileName });
    expect(within(dialog).getByRole('region', { name: 'Sheet preview' })).toBeInTheDocument();
  });

  it('reviews the rows that need fixing and imports the rest', async () => {
    const onCommit = vi.fn();
    render(<ImportView {...props({ step: 'review', onCommit })} />);

    expect(screen.getByRole('list', { name: 'Need fixing rows' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /error report/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import 59 rows' }));
    expect(onCommit).toHaveBeenCalled();
  });

  it('notes that rows needing fixes are left out, with no option to stop', () => {
    render(<ImportView {...props({ step: 'review' })} />);

    expect(screen.queryByText(/stop/i)).not.toBeInTheDocument();
    expect(screen.getByText(/upload the fixed version/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 59 rows' })).toBeEnabled();
  });

  it('celebrates the import on its own step, without the review table', () => {
    const onStartOver = vi.fn();
    render(
      <ImportView
        {...props({ step: 'done', record: { ...record, status: 'committed' }, onStartOver })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Imported 59 rows' })).toBeInTheDocument();
    expect(screen.getByTestId('confetti')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Need fixing rows' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import \d+ rows/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Employees' })).toHaveAttribute(
      'href',
      '/employees',
    );
    expect(screen.getByRole('button', { name: 'Import another file' })).toBeInTheDocument();
  });

  it('shows no confetti once the import is undone', () => {
    render(<ImportView {...props({ step: 'done', record: { ...record, status: 'undone' } })} />);

    expect(screen.getByRole('heading', { name: 'Import undone' })).toBeInTheDocument();
    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo import' })).not.toBeInTheDocument();
  });

  it('offers undo after the import', async () => {
    const onUndo = vi.fn();
    render(
      <ImportView
        {...props({ step: 'done', record: { ...record, status: 'committed' }, onUndo })}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Undo import' }));
    expect(onUndo).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: 'Undo this import?' });
    expect(dialog).toHaveTextContent(/Deletes the \d+ employees it added/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Undo import' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('links back to Employees', () => {
    render(<ImportView {...props()} />);

    expect(screen.getByRole('link', { name: 'Employees' })).toHaveAttribute('href', '/employees');
  });

  it('titles review rows by name, with the code, and shows salaries in their currency', () => {
    const rows: ImportRow[] = [
      {
        rowNumber: 3,
        outcome: 'update',
        employeeCode: 'ACM-005809',
        employeeName: 'Sofia Lange',
        countryCode: 'DE',
        changes: { salaryAmountMinor: { from: 18_850_000, to: 19_000_000 } },
        errors: [],
      },
      {
        rowNumber: 4,
        outcome: 'create',
        employeeCode: null,
        employeeName: 'Neha Kapoor',
        countryCode: 'IN',
        changes: { firstName: { from: null, to: 'Neha' } },
        errors: [],
      },
    ];
    render(
      <ImportView
        {...props({
          step: 'review',
          outcome: 'update',
          rows: { status: 'success', items: rows, total: 2, page: 1, pageSize: 25 },
          changeContext: { ...props().changeContext, updateCurrency: undefined },
        })}
      />,
    );

    const list = screen.getByRole('list', { name: 'Updates rows' });
    const [update, create] = within(list).getAllByRole('listitem');
    expect(update).toHaveTextContent('Sofia Lange');
    expect(update).toHaveTextContent('ACM-005809');
    expect(update).toHaveTextContent('Salary: €188,500 → €190,000');
    expect(create).toHaveTextContent('Neha Kapoor');
    expect(create).toHaveTextContent('New employee');
  });

  it("lists a row's several problems one per line", () => {
    const row: ImportRow = {
      rowNumber: 5,
      outcome: 'error',
      employeeCode: null,
      employeeName: 'Bad Row',
      changes: {},
      errors: [
        { column: 'E-mail', message: 'Not an email' },
        { column: 'DOJ', message: 'Not a date; use YYYY-MM-DD' },
      ],
    };
    render(
      <ImportView
        {...props({
          step: 'review',
          rows: { status: 'success', items: [row], total: 1, page: 1, pageSize: 25 },
        })}
      />,
    );

    const card = screen.getByRole('list', { name: 'Need fixing rows' });
    const problems = within(card).getByText('E-mail: Not an email').closest('ul')!;
    expect(
      within(problems)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['E-mail: Not an email', 'DOJ: Not a date; use YYYY-MM-DD']);
  });
});
