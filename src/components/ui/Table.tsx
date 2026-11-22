import type { ReactNode } from 'react';
import { classNames } from '../../utils/class-names';
import { useCopy } from '../../hooks/use-copy';

export interface Column<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

/**
 * Figma admin table: 12px sentence-case headers (D-161), 44px rows, right-aligned mono
 * numbers. `dense` narrows the cell padding for a table that shares its row
 * with side panels (SCR-16). `cards` turns each row into a card below 640 px
 * (T-141): the header row hides and every cell shows its column name, so a
 * phone reads the row without scrolling sideways.
 */
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage,
  onRowClick,
  dense = false,
  cards = false,
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  cards?: boolean;
}) {
  const copy = useCopy();
  const padX = dense ? 'px-3' : 'px-5';
  const card = (classes: string) => (cards ? classes : false);
  // A table drawn as blocks loses its semantics in some screen readers, so
  // card mode names the roles itself.
  const role = (name: string) => (cards ? name : undefined);
  return (
    <div
      className="overflow-x-auto rounded-xl border border-line"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table
        role={role('table')}
        className={classNames('w-full border-collapse', card('max-sm:block'))}
      >
        <caption className="sr-only">{caption}</caption>
        <thead
          role={role('rowgroup')}
          className={card('max-sm:hidden') || undefined}
        >
          <tr role={role('row')} className="border-b border-line bg-page-alt">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                role={role('columnheader')}
                className={classNames(
                  padX,
                  'py-3 text-xs font-medium whitespace-nowrap text-muted-x',
                  column.numeric ? 'text-right' : 'text-left',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          role={role('rowgroup')}
          className={classNames('bg-surface', card('max-sm:block'))}
        >
          {rows.length ? (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                role={role('row')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={classNames(
                  'border-b border-line last:border-b-0 hover:bg-raised',
                  onRowClick && 'cursor-pointer',
                  card('max-sm:block max-sm:py-2'),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    role={role('cell')}
                    data-label={cards ? column.header : undefined}
                    className={classNames(
                      padX,
                      'py-3 text-xs whitespace-nowrap text-fg-2',
                      column.numeric && 'text-right font-mono',
                      card(
                        'max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:px-4 max-sm:py-1.5 max-sm:text-right max-sm:whitespace-normal max-sm:before:shrink-0 max-sm:before:text-left max-sm:before:font-sans max-sm:before:text-xs max-sm:before:font-medium max-sm:before:tracking-[0.06em] max-sm:before:text-muted-x max-sm:before:uppercase max-sm:before:content-[attr(data-label)]',
                      ),
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr
              role={role('row')}
              className={card('max-sm:block') || undefined}
            >
              <td
                role={role('cell')}
                colSpan={Math.max(columns.length, 1)}
                className={classNames(
                  'px-5 py-8 text-center text-xs text-muted-dim',
                  card('max-sm:block'),
                )}
              >
                {emptyMessage ?? copy.common.noRecords}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
