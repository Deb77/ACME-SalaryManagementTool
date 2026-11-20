import { render, screen, within } from '../../../test/render';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

describe('DataTable', () => {
  it('renders one row per item and a server-side total', () => {
    renderTable({ page: 1, pageSize: 10 });

    const table = screen.getByRole('table');
    expect(within(table).getByText('Priya Sharma')).toBeInTheDocument();
    expect(within(table).getByText('Data Analyst')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–10 of 25 employees')).toBeInTheDocument();
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
});
