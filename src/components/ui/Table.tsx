import type { ReactNode } from 'react';
export interface Column<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
}
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage = 'No records available.',
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={column.numeric ? 'numeric' : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={column.numeric ? 'numeric' : undefined}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={Math.max(columns.length, 1)}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
