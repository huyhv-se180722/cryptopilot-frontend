import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';

/** The latest articles the panel lists. */
const LATEST = 5;

/**
 * SCR-10 / SCR-11 latest news tagged with the base coin (SRS 3.3.2),
 * linking to that coin's news on SCR-28; an article opens its page in the
 * app (D-125).
 */
export function PairNews({ coin }: { coin: string }) {
  const copy = useCopy();
  const { news } = useServices();
  const query = useQuery({
    queryKey: ['news', 'latest', coin, LATEST],
    queryFn: ({ signal }) =>
      news.feed({ coin, page: 1, pageSize: LATEST }, signal),
  });
  return (
    <section
      aria-labelledby="pair-news-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2
          id="pair-news-title"
          className="text-[10px] font-semibold tracking-widest text-muted-x uppercase"
        >
          {formatCopy(copy.analysis.newsTitle, { coin })}
        </h2>
        <Link
          to={'/news?coin=' + encodeURIComponent(coin)}
          className="text-[11px] no-underline"
        >
          {formatCopy(copy.news.allCoinNews, { coin })}
        </Link>
      </div>
      {query.isError ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Newspaper size={14} aria-hidden="true" />
          {errorText(copy, query.error)}
        </p>
      ) : query.data?.items.length ? (
        <ul className="flex flex-col gap-2">
          {query.data.items.map((article) => (
            <li key={article.id} className="text-xs">
              <Link to={'/news/' + encodeURIComponent(article.id)}>
                {article.title}
              </Link>
              <span className="ml-1.5 text-[11px] text-muted-dim">
                {article.source}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">
          {query.isPending ? copy.common.loading : copy.messages.MSG41}
        </p>
      )}
    </section>
  );
}
