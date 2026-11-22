import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { sampleEmployees, sampleMeta } from '../../stories/screenSampleData';
import { render, screen, within } from '../../test/render';
import userEvent from '@testing-library/user-event';
import { EmployeesView, type EmployeesViewProps } from './EmployeesView';

const props = (overrides: Partial<EmployeesViewProps> = {}): EmployeesViewProps => ({
  status: 'success',
  rows: sampleEmployees,
  total: sampleEmployees.length,
  query: { page: 1, pageSize: 25 },
  onQueryChange: vi.fn(),
  search: '',
  onSearchChange: vi.fn(),
  filters: { status: 'active' },
  onFiltersChange: vi.fn(),
  countries: sampleMeta.countries,
  departments: [],
  jobTitles: [],
  exportHref: '/api/employees.csv',
  canAdd: true,
  canImport: true,
  ...overrides,
});

describe('EmployeesView', () => {
  it('lists employees as cards on phones, with the actions the user may take', () => {
    render(<EmployeesView {...props()} />);

    const list = screen.getByRole('list', { name: 'Employees' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(sampleEmployees.length);
    expect(screen.getByRole('link', { name: /Add employee/ })).toHaveAttribute(
      'href',
      '/employees/new',
    );
    expect(screen.getByRole('link', { name: /Import from Excel/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Export \d+ as CSV$/ })).toHaveAttribute(
      'href',
      '/api/employees.csv',
    );
  });

  it('says the export holds only the people that match the filters', () => {
    const { rerender } = render(<EmployeesView {...props({ total: 9514 })} />);
    expect(
      screen.getByText('9,514 active people · Export uses the current search and filters'),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Export 9,514 as CSV' });
    expect(link).toHaveAttribute(
      'title',
      'Downloads the 9,514 people that match the search and filters',
    );

    // While new results load the count isn't known yet, so it doesn't show a stale one.
    rerender(<EmployeesView {...props({ total: 9514, refreshing: true })} />);
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute(
      'title',
      'Downloads the people that match the search and filters',
    );
  });

  it('hides add, import and export without the permissions', () => {
    render(
      <EmployeesView {...props({ canAdd: false, canImport: false, exportHref: undefined })} />,
    );

    expect(screen.queryByRole('link', { name: /Add employee/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Import from Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Export/ })).not.toBeInTheDocument();
  });

  it('explains an empty search', () => {
    render(<EmployeesView {...props({ rows: [], total: 0, search: 'zzz' })} />);

    expect(screen.getByText('No employees match')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    const onRetry = vi.fn();
    render(
      <EmployeesView
        {...props({
          status: 'error',
          rows: [],
          total: 0,
          error: new ApiError(500, 'internal_error', 'boom'),
          onRetry,
        })}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('reports searches to the container', async () => {
    const onSearchChange = vi.fn();
    render(<EmployeesView {...props({ onSearchChange })} />);

    await userEvent.type(screen.getByLabelText('Search employees'), 'P');
    expect(onSearchChange).toHaveBeenCalledWith('P');
  });

  it('shows skeleton cards, not the old rows, while a search reloads', () => {
    const { container } = render(
      <EmployeesView {...props({ status: 'loading', refreshing: true, search: 'pri' })} />,
    );

    expect(screen.queryByRole('list', { name: 'Employees' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Search employees')).toHaveValue('pri');
    expect(screen.getByRole('status')).toHaveTextContent('Loading employees…');
  });

  it('never shows the previous count as current while new results load', () => {
    render(<EmployeesView {...props({ total: 42, refreshing: true, search: 'pri' })} />);

    expect(screen.queryByText(/42 matching people/)).not.toBeInTheDocument();
  });

  it('keeps the count while another page or sort of the same results loads', () => {
    render(
      <EmployeesView
        {...props({
          // As the screen passes it while the next page loads.
          status: 'loading',
          total: 42,
          refreshing: true,
          counting: false,
          search: 'pri',
          exportHref: '/api/employees/export',
        })}
      />,
    );

    expect(screen.getByText(/^42 matching people/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Export 42/ })).toBeInTheDocument();
  });

  it('shows the count once the results have loaded', () => {
    render(<EmployeesView {...props({ total: 42, search: 'pri' })} />);

    expect(screen.getByText(/^42 matching people/)).toBeInTheDocument();
  });

  it('offers a Country filter only when the user can see more than one country', () => {
    const { unmount } = render(<EmployeesView {...props()} />);
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeInTheDocument();
    unmount();

    render(<EmployeesView {...props({ countries: sampleMeta.countries.slice(0, 1) })} />);
    expect(screen.queryByRole('combobox', { name: 'Country' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeInTheDocument();
  });

  it('keeps the full job title and country readable on the cards', () => {
    const [employee] = sampleEmployees;
    render(<EmployeesView {...props()} />);

    const country = sampleMeta.countries.find((c) => c.code === employee!.country)!.name;
    const detail = `${employee!.jobTitle.name} · ${country}`;
    expect(screen.getAllByText(detail)[0]).toHaveAttribute('title', detail);
  });

  it('puts the primary Add employee action with the secondary ones in one actions group', () => {
    render(<EmployeesView {...props()} />);

    const add = screen.getByRole('link', { name: /Add employee/ });
    const group = add.parentElement!;
    expect(group).toContainElement(screen.getByRole('link', { name: /^Export/ }));
    expect(group).toContainElement(screen.getByRole('link', { name: /Import from Excel/ }));
  });

  it('clears every filter, Status included, and keeps Clear filters in place when there is nothing to clear', async () => {
    const onFiltersChange = vi.fn();
    const onSearchChange = vi.fn();
    const { rerender } = render(
      <EmployeesView
        {...props({
          search: 'pri',
          appliedSearch: 'pri',
          filters: { status: 'active', country: 'IN' },
          onFiltersChange,
          onSearchChange,
        })}
      />,
    );

    const filters = screen.getByRole('group', { name: 'Filters' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Clear filters' }));
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onFiltersChange).toHaveBeenCalledWith({ status: 'all' });

    rerender(<EmployeesView {...props({ total: 10004, filters: { status: 'all' } })} />);
    expect(within(filters).getByRole('button', { name: 'Clear filters' })).toBeDisabled();
    expect(screen.getByText(/^10,004 people/)).toBeInTheDocument();
  });
});
