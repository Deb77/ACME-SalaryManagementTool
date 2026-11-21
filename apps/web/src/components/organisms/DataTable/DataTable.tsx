import { NativeSelect, Pagination, Table, UnstyledButton, VisuallyHidden } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { AriaAttributes, Key, ReactNode } from 'react';
import { mediaQueries } from '../../../theme/tokens';
import { Skeleton } from '../../atoms/Skeleton/Skeleton';
import styles from './DataTable.module.css';
import { nextSort, parseSortValue, sortValue } from './DataTable.utils';

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
  /** Plain-text name for the phone sort menu when `title` is not a string. */
  sortLabel?: string;
  /** What this cell looks like while rows load (`skeletonRows`); defaults to one text line. */
  skeleton?: ReactNode;
  /**
   * Only shown from the `wide` breakpoint (1280px). Below it the table drops the column and
   * tightens cell padding, so the remaining columns fit tablets and small laptops unclipped.
   */
  wideOnly?: boolean;
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
  /**
   * True while a new page, search, filter or sort loads over rows already shown: placeholder
   * rows (cards on phones) replace the rows, as on first load, while the column headers, sort
   * menu and pagination stay mounted so focus and layout hold.
   */
  loading?: boolean;
  /** Shown instead of rows when there are none (use EmptyState). */
  empty?: ReactNode;
  /** Noun for the "Showing 1–10 of 2,412 …" summary. */
  itemName?: string;
  /**
   * Phone layout: below the tablet breakpoint each row renders as this card in a list, and
   * sorting moves to a "Sort" menu. Without it the table scrolls sideways inside its card.
   */
  renderCard?: (row: T) => ReactNode;
  /**
   * Fill the parent's height (a TrayCard with `fill`) from desktop width: rows scroll under
   * a sticky column header while the summary and pagination stay at the bottom.
   */
  fill?: boolean;
  /**
   * Draw this many placeholder rows under the real column headers (cards on phones) instead
   * of `rows`, so the table keeps its exact shape while the first page loads.
   */
  skeletonRows?: number;
  /** Phone card placeholder for `skeletonRows`; defaults to two text lines. */
  skeletonCard?: ReactNode;
}

/** Placeholder rows while `loading` when `skeletonRows` is not set. */
const DEFAULT_LOADING_ROWS = 8;

/** Varied line widths so placeholder rows don't look like a barcode. */
const LINE_WIDTHS = ['72%', '58%', '84%', '64%'];

/** One line of text: inline, so the cell keeps the real text's line height and alignment. */
function defaultCellSkeleton(row: number) {
  return <Skeleton inline width={LINE_WIDTHS[row % LINE_WIDTHS.length]} height={12} />;
}

const DEFAULT_CARD_SKELETON = (
  <div className={styles.skeletonCard}>
    <Skeleton width="55%" height={16} />
    <Skeleton width="80%" height={12} />
  </div>
);

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
  columns: allColumns,
  rows,
  rowKey,
  total,
  query,
  onQueryChange,
  loading = false,
  empty,
  itemName = 'rows',
  renderCard,
  fill = false,
  skeletonRows,
  skeletonCard = DEFAULT_CARD_SKELETON,
}: DataTableProps<T, F>) {
  const placeholderCount = skeletonRows || (loading ? DEFAULT_LOADING_ROWS : 0);
  const placeholders = placeholderCount
    ? Array.from({ length: placeholderCount }, (_, i) => i)
    : null;
  // First load (or a reload with nothing to page through yet): the footer is a placeholder too.
  const footerSkeleton = Boolean(skeletonRows) || (loading && total === 0);
  const wide = useMediaQuery(mediaQueries.tablet);
  const roomy = useMediaQuery(mediaQueries.wide);
  const cardRenderer = wide ? undefined : renderCard;
  const tight = !roomy && allColumns.some((column) => column.wideOnly);
  const columns = roomy ? allColumns : allColumns.filter((column) => !column.wideOnly);
  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  const sortBy = (field: F) =>
    onQueryChange({ ...query, page: 1, sort: nextSort(query.sort, field) });

  // The phone sort menu offers every sortable column, including ones the table hides.
  const sortable = allColumns.filter((column) => column.sortable);
  const columnLabel = (column: DataTableColumn<T>) =>
    column.sortLabel ?? (typeof column.title === 'string' ? column.title : column.key);

  const body = cardRenderer ? (
    <>
      {sortable.length > 0 && (
        <div className={styles.cardToolbar}>
          <NativeSelect
            label="Sort"
            value={sortValue(query.sort)}
            onChange={(event) =>
              onQueryChange({
                ...query,
                page: 1,
                sort: parseSortValue<F>(event.currentTarget.value),
              })
            }
            data={[
              { value: '', label: 'Default order' },
              ...sortable.flatMap((column) => [
                { value: `${column.key}:asc`, label: `${columnLabel(column)} (ascending)` },
                { value: `${column.key}:desc`, label: `${columnLabel(column)} (descending)` },
              ]),
            ]}
            classNames={{ root: styles.sortRoot, label: styles.sortLabel, input: styles.sortInput }}
          />
        </div>
      )}
      {placeholders ? (
        <ul aria-hidden="true" className={styles.cards}>
          {placeholders.map((index) => (
            <li key={index} className={styles.card}>
              {skeletonCard}
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>{empty ?? 'No data'}</div>
      ) : (
        <ul aria-label={label} className={styles.cards}>
          {rows.map((row) => (
            <li key={rowKey(row)} className={styles.card}>
              {cardRenderer(row)}
            </li>
          ))}
        </ul>
      )}
    </>
  ) : (
    <TableScroller fill={fill}>
      <Table
        aria-label={label}
        className={styles.table}
        highlightOnHover
        // With every column sized, a fixed layout keeps the columns put whatever the rows hold
        // (other pages, placeholder rows).
        layout={columns.every((column) => column.width !== undefined) ? 'fixed' : undefined}
        stickyHeader={fill}
        verticalSpacing="md"
        horizontalSpacing={tight ? 'sm' : 'md'}
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
          {placeholders ? (
            placeholders.map((index) => (
              <Table.Tr key={index} aria-hidden="true">
                {columns.map((column) => (
                  <Table.Td key={column.key} style={{ textAlign: column.align }}>
                    {column.skeleton ?? defaultCellSkeleton(index)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          ) : rows.length === 0 ? (
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
    </TableScroller>
  );

  return (
    <div
      className={fill ? `${styles.wrapper} ${styles.fill}` : styles.wrapper}
      aria-busy={loading || undefined}
    >
      {/* Always mounted, so screen readers hear the change when a reload starts. */}
      <VisuallyHidden role="status" aria-live="polite">
        {loading ? `Loading ${itemName}…` : ''}
      </VisuallyHidden>
      {body}

      {footerSkeleton && (
        <div className={styles.footer} aria-hidden="true">
          <span className={styles.summary}>
            <Skeleton inline width={170} height={11} />
          </span>
          <Skeleton width={wide ? 96 : 140} height={wide ? 32 : 44} pill />
        </div>
      )}

      {!footerSkeleton && total > 0 && (
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
            siblings={wide ? 1 : 0}
            boundaries={1}
            classNames={{ control: styles.pageControl }}
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

/**
 * Normal tables scroll sideways in Mantine's container, with a visible scrollbar whenever the
 * table is wider than its card (tablets). A filling table scrolls both ways in a plain box,
 * because the sticky header needs the vertical scroller to be its nearest one.
 */
function TableScroller({ fill, children }: { fill: boolean; children: ReactNode }) {
  if (fill) {
    return (
      <div className={styles.scroller} tabIndex={0} role="region" aria-label="Table rows">
        {children}
      </div>
    );
  }
  return (
    <Table.ScrollContainer minWidth={0} scrollAreaProps={{ type: 'auto' }}>
      {children}
    </Table.ScrollContainer>
  );
}
