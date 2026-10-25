import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { classNames } from '../../../utils/class-names';
import { pageNumbers } from './news-format';

const cell =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium';

/**
 * The feed's pages, as a news site numbers them: previous, the first and
 * last page with the ones around the current, next. Nothing is drawn for a
 * single page.
 */
export function NewsPagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  const copy = useCopy();
  const n = copy.news;
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={n.pagination}
      className="mt-4 flex flex-wrap items-center justify-center gap-1.5"
    >
      <button
        type="button"
        className={classNames(
          cell,
          'gap-1 border-line bg-surface text-fg-2 hover:border-primary-line disabled:opacity-40',
        )}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        {n.previous}
      </button>
      {pageNumbers(page, pages).map((item, index) =>
        item === null ? (
          <span key={'gap' + index} className="px-1 text-xs text-muted-dim">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={formatCopy(n.pageLabel, { page: item })}
            aria-current={item === page ? 'page' : undefined}
            className={classNames(
              cell,
              item === page
                ? 'border-primary bg-primary text-white'
                : 'border-line bg-surface text-fg-2 hover:border-primary-line',
            )}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={classNames(
          cell,
          'gap-1 border-line bg-surface text-fg-2 hover:border-primary-line disabled:opacity-40',
        )}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        {n.next}
        <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}
