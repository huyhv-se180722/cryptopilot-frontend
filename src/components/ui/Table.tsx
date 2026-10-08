import type { ReactNode } from 'react';
import { classNames } from '../../utils/class-names';
import { useCopy } from '../../hooks/use-copy';

export interface Column<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}

/** Figma admin table: uppercase 10px headers, 44px rows, right-aligned mono numbers. */
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage,
  onRowClick,
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}) {
  const copy = useCopy();
  return (
    <div
      className="overflow-x-auto rounded-xl border border-line"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-page-alt">
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={classNames(
                  'px-5 py-3 text-[10px] font-medium tracking-[0.07em] whitespace-nowrap text-muted-x uppercase',
                  column.numeric ? 'text-right' : 'text-left',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-surface">
          {rows.length ? (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={classNames(
                  'border-b border-line last:border-b-0 hover:bg-raised',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={classNames(
                      'px-5 py-3 text-xs whitespace-nowrap text-fg-2',
                      column.numeric && 'text-right font-mono',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={Math.max(columns.length, 1)}
                className="px-5 py-8 text-center text-xs text-muted-dim"
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
