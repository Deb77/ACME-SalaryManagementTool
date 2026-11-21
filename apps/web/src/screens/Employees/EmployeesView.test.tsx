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
    expect(screen.getByRole('link', { name: /Export CSV/ })).toHaveAttribute(
      'href',
      '/api/employees.csv',
    );
  });

  it('hides add, import and export without the permissions', () => {
    render(
      <EmployeesView {...props({ canAdd: false, canImport: false, exportHref: undefined })} />,
    );

    expect(screen.queryByRole('link', { name: /Add employee/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Import from Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Export CSV/ })).not.toBeInTheDocument();
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
});
