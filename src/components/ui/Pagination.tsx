import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { classNames } from '../../utils/class-names';
import { pageItems } from './pagination-items';

const cell =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors duration-150 pointer-coarse:h-11 pointer-coarse:min-w-11';

/**
 * Numbered pages with Previous and Next; nothing for a single page. The
 * page is 1-based, as the backend counts it (CR-04).
 */
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
  disabled = false,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const p = useCopy().common.pagination;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const current = Math.min(Math.max(1, page), pages);
  return (
    <nav
      aria-label={p.label}
      className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
    >
      <button
        type="button"
        aria-label={p.previous}
        disabled={disabled || current === 1}
        onClick={() => onChange(current - 1)}
        className={classNames(
          cell,
          'border border-line bg-surface text-fg-2 hover:enabled:bg-raised disabled:opacity-40',
        )}
      >
        <ChevronLeft size={14} aria-hidden="true" />
      </button>
      {pageItems(current, pages).map((item, index) =>
        item === 'gap' ? (
          <span
            key={'gap-' + index}
            aria-hidden="true"
            className="px-1 text-muted-x"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={formatCopy(p.page, { n: item })}
            aria-current={item === current ? 'page' : undefined}
            disabled={disabled}
            onClick={() => item !== current && onChange(item)}
            className={classNames(
              cell,
              item === current
                ? 'bg-primary text-white'
                : 'border border-line bg-surface text-fg-2 hover:enabled:bg-raised',
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label={p.next}
        disabled={disabled || current === pages}
        onClick={() => onChange(current + 1)}
        className={classNames(
          cell,
          'border border-line bg-surface text-fg-2 hover:enabled:bg-raised disabled:opacity-40',
        )}
      >
        <ChevronRight size={14} aria-hidden="true" />
      </button>
      <span className="ml-2 text-[11px] text-muted-x">
        {formatCopy(p.summary, { page: current, pages })}
      </span>
    </nav>
  );
}
