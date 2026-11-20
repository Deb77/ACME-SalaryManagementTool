import { LoadingOverlay, Pagination, Table, UnstyledButton } from '@mantine/core';
import type { AriaAttributes, Key, ReactNode } from 'react';
import styles from './DataTable.module.css';
import { nextSort } from './DataTable.utils';

export type SortOrder = 'asc' | 'desc';

/** Server-side table state: what the API needs to fetch the current page. */
export interface TableQuery<F extends string = string> {
  page: number;
  pageSize: number;
  sort?: { field: F; order: SortOrder };
}

export interface DataTableColumn<T> {
  /** Stable key; for sortable columns this is the field sent to the API. */
  key: string;
  title: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

export interface DataTableProps<T, F extends string = string> {
  /** Accessible name for the table (it usually sits in a TrayCard). */
  label: string;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => Key;
  total: number;
  query: TableQuery<F>;
  onQueryChange: (query: TableQuery<F>) => void;
  loading?: boolean;
  /** Shown instead of rows when there are none (use EmptyState). */
  empty?: ReactNode;
  /** Noun for the "Showing 1–10 of 2,412 …" summary. */
  itemName?: string;
}

const ARIA_SORT: Record<SortOrder, AriaAttributes['aria-sort']> = {
  asc: 'ascending',
  desc: 'descending',
};

/**
 * Mantine Table and Pagination wired for server-side paging and sorting. The
 * parent owns `query` and fetches; this component only renders rows and
 * reports changes. Changing the sort returns to page 1 so the user never lands
 * mid-list. Sortable headers hold a real button, so sorting works from the
 * keyboard.
 */
export function DataTable<T, F extends string = string>({
  label,
  columns,
  rows,
  rowKey,
  total,
  query,
  onQueryChange,
  loading = false,
  empty,
  itemName = 'rows',
}: DataTableProps<T, F>) {
  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  const sortBy = (field: F) =>
    onQueryChange({ ...query, page: 1, sort: nextSort(query.sort, field) });

  return (
    <div className={styles.wrapper}>
      <Table.ScrollContainer minWidth={0}>
        <Table
          aria-label={label}
          className={styles.table}
          highlightOnHover
          verticalSpacing="md"
          horizontalSpacing="md"
        >
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => {
                const sorted = query.sort?.field === column.key ? query.sort.order : undefined;
                return (
                  <Table.Th
                    key={column.key}
                    className={styles.th}
                    style={{ width: column.width, textAlign: column.align }}
                    aria-sort={column.sortable ? (sorted ? ARIA_SORT[sorted] : 'none') : undefined}
                  >
                    {column.sortable ? (
                      <UnstyledButton
                        className={styles.sortButton}
                        onClick={() => sortBy(column.key as F)}
                      >
                        {column.title}
                        <span className={styles.sortIcon} aria-hidden data-order={sorted}>
                          {sorted === 'desc' ? '▼' : '▲'}
                        </span>
                      </UnstyledButton>
                    ) : (
                      column.title
                    )}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={columns.length} className={styles.empty}>
                  {empty ?? 'No data'}
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <Table.Td key={column.key} style={{ textAlign: column.align }}>
                      {column.render(row)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <LoadingOverlay visible={loading} overlayProps={{ blur: 1 }} />

      {total > 0 && (
        <div className={styles.footer}>
          <span className={styles.summary}>
            {`Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()} ${itemName}`}
          </span>
          <Pagination
            total={pageCount}
            value={query.page}
            onChange={(page) => onQueryChange({ ...query, page })}
            radius="xl"
            size="sm"
            getItemProps={(page) => ({ 'aria-label': `Page ${page}` })}
            getControlProps={(control) =>
              control === 'previous'
                ? { 'aria-label': 'Previous page' }
                : control === 'next'
                  ? { 'aria-label': 'Next page' }
                  : {}
            }
            withEdges={false}
          />
        </div>
      )}
    </div>
  );
}
