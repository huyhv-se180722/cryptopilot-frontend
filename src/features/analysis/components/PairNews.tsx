import { useQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';

/**
 * SCR-10 latest news of the base coin (SRS 3.3.2), linking to SCR-28. The
 * news API is T-080: until it exists the port answers NOT_CONFIGURED and
 * the panel says so instead of showing invented articles.
 */
export function PairNews({ coin }: { coin: string }) {
  const copy = useCopy();
  const { news } = useServices();
  const query = useQuery({
    queryKey: ['news', 'latest'],
    queryFn: ({ signal }) => news.list({ limit: 5, signal }),
  });
  return (
    <section
      aria-labelledby="pair-news-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="pair-news-title"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {formatCopy(copy.analysis.newsTitle, { coin })}
      </h2>
      {query.isError ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Newspaper size={14} aria-hidden="true" />
          {errorText(copy, query.error)}
        </p>
      ) : query.data?.items.length ? (
        <ul className="flex flex-col gap-2">
          {query.data.items.map((article) => (
            <li key={article.id} className="text-xs">
              <a href={article.originalUrl} target="_blank" rel="noreferrer">
                {article.title}
              </a>
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
