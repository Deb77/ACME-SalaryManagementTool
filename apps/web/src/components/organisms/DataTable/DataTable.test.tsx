import { render, screen, within } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableColumn, type TableQuery } from './DataTable';

interface Row {
  id: string;
  name: string;
  title: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'name', title: 'Name', render: (row) => row.name, sortable: true },
  { key: 'title', title: 'Job title', render: (row) => row.title },
];

const rows: Row[] = [
  { id: '1', name: 'Priya Sharma', title: 'Senior Software Engineer' },
  { id: '2', name: 'Arjun Mehta', title: 'Data Analyst' },
];

function renderTable(query: TableQuery, onQueryChange = vi.fn()) {
  render(
    <DataTable
      label="Employees"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      total={25}
      query={query}
      onQueryChange={onQueryChange}
      itemName="employees"
    />,
  );
  return onQueryChange;
}

/** Makes `matchMedia` match the tablet query only (the setup's mock never matches: a phone). */
function mockTabletViewport() {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(min-width: 768px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => {
    window.matchMedia = original;
  });
}

describe('DataTable', () => {
  mockTabletViewport();

  it('renders one row per item and a server-side total', () => {
    renderTable({ page: 1, pageSize: 10 });

    const table = screen.getByRole('table');
    expect(within(table).getByText('Priya Sharma')).toBeInTheDocument();
    expect(within(table).getByText('Data Analyst')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 25 employees')).toBeInTheDocument();
  });

  it('shows only the summary when everything fits on one page', () => {
    render(
      <DataTable
        label="Countries"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={2}
        query={{ page: 1, pageSize: 10 }}
        onQueryChange={vi.fn()}
        itemName="countries"
      />,
    );

    expect(screen.getByText('Showing 1–2 of 2 countries')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
  });

  it('asks for the next page when a page is chosen', async () => {
    const onQueryChange = renderTable({ page: 1, pageSize: 10 });

    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(onQueryChange).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });

  it('sorts by the column key and returns to the first page', async () => {
    const onQueryChange = renderTable({ page: 3, pageSize: 10 });

    // A real button inside the header, so sorting works from the keyboard too.
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));

    expect(onQueryChange).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sort: { field: 'name', order: 'asc' },
    });
  });

  it('swaps the rows for skeleton rows while a new page loads, keeping headers and paging', () => {
    const { container } = render(
      <DataTable
        label="Employees"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={25}
        query={{ page: 1, pageSize: 10 }}
        onQueryChange={vi.fn()}
        itemName="employees"
        loading
      />,
    );

    expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
    expect(container.querySelectorAll('tbody [data-skeleton]').length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading employees…');
    expect(container.querySelector('.mantine-LoadingOverlay-root')).not.toBeInTheDocument();
  });

  it('marks the sorted column for assistive technology', () => {
    renderTable({ page: 1, pageSize: 10, sort: { field: 'name', order: 'desc' } });

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
});

describe('DataTable on a phone', () => {
  // The test setup's matchMedia never matches, which is the phone (base) layout.
  function renderCards(query: TableQuery, onQueryChange = vi.fn()) {
    render(
      <DataTable
        label="Employees"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={25}
        query={query}
        onQueryChange={onQueryChange}
        itemName="employees"
        renderCard={(row) => `${row.name} — ${row.title}`}
      />,
    );
    return onQueryChange;
  }

  it('renders a list of cards instead of the table', () => {
    renderCards({ page: 1, pageSize: 10 });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Employees' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Arjun Mehta — Data Analyst')).toBeInTheDocument();
  });

  it('moves sorting to a Sort menu built from the sortable columns', async () => {
    const onQueryChange = renderCards({ page: 2, pageSize: 10 });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'name:desc');

    expect(onQueryChange).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sort: { field: 'name', order: 'desc' },
    });
  });

  it('pages with previous / "Page x of y" / next instead of numbered pages', async () => {
    const onQueryChange = renderCards({ page: 1, pageSize: 10 });

    expect(screen.getByText('Showing 1–10 of 25 employees')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Page 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onQueryChange).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });

  it('formats large page counts and disables next on the last page', async () => {
    const onQueryChange = vi.fn();
    render(
      <DataTable
        label="Employees"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={11_890}
        query={{ page: 1189, pageSize: 10 }}
        onQueryChange={onQueryChange}
        itemName="employees"
        renderCard={(row) => row.name}
      />,
    );

    expect(screen.getByText('Page 1,189 of 1,189')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));

    expect(onQueryChange).toHaveBeenCalledWith({ page: 1188, pageSize: 10 });
  });

  it('follows the row link from a click anywhere on the row', async () => {
    const onLinkClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <DataTable
        label="Employees"
        columns={[
          {
            key: 'name',
            title: 'Name',
            render: (row: Row) => (
              <a href={`/employees/${row.id}`} onClick={onLinkClick}>
                {row.name}
              </a>
            ),
          },
          { key: 'title', title: 'Job title', render: (row: Row) => row.title },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        total={2}
        query={{ page: 1, pageSize: 10 }}
        onQueryChange={vi.fn()}
        rowLink
      />,
    );

    await userEvent.click(screen.getByText('Data Analyst'));
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect((onLinkClick.mock.calls[0]![0].target as HTMLAnchorElement).textContent).toBe(
      'Arjun Mehta',
    );

    // A click on the link itself is the link's own, not a second one from the row.
    await userEvent.click(screen.getByRole('link', { name: 'Priya Sharma' }));
    expect(onLinkClick).toHaveBeenCalledTimes(2);
  });
});
