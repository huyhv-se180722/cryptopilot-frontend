import { Link } from 'react-router-dom';
import { ErrorState } from '../../../components/feedback/States';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import { formatInstantUtc } from '../../../utils/instant-format';
import { useLatestNews } from '../../news/hooks/use-news';
import { newsAge } from '../../news/components/news-format';
import { DashboardCard, PendingBlock } from './DashboardCard';

/** The latest articles the block lists. */
const LATEST = 5;

/**
 * Latest news (SCR-08, opens SCR-28): the five newest articles of the
 * feed with their outlet, age and first coin, the AI's headline once
 * summarized (D-123), each opening its page in the app (D-125). A failed
 * feed says so in one line with a retry (T-139).
 */
export function NewsBlock() {
  const copy = useCopy();
  const d = copy.dashboard;
  const query = useLatestNews(LATEST);
  let body;
  if (query.isPending)
    body = (
      <div className="grid gap-2 p-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-10 w-full" />
        ))}
      </div>
    );
  else if (query.isError)
    body = (
      <div className="p-3">
        <ErrorState
          variant="inline"
          title={d.newsError}
          message={errorText(copy, query.error)}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  else if (query.data.items.length === 0)
    body = <PendingBlock message={copy.messages.MSG41} />;
  else
    body = (
      <ul>
        {query.data.items.map((article) => {
          const coin =
            article.coins.find((tag) => tag.primary) ?? article.coins[0];
          return (
            <li
              key={article.id}
              className="border-b border-line last:border-b-0"
            >
              <Link
                to={'/news/' + encodeURIComponent(article.id)}
                className="block px-4 py-2.5 text-fg no-underline hover:bg-raised"
              >
                <span className="flex gap-2 text-[11px] text-muted-dim">
                  <span className="font-semibold text-fg-2">
                    {article.source}
                  </span>
                  <time
                    dateTime={article.publishedAt}
                    title={formatInstantUtc(article.publishedAt)}
                  >
                    {newsAge(copy, article.publishedAt)}
                  </time>
                  {coin && (
                    <span className="ml-auto font-semibold text-link">
                      {coin.symbol}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug">
                  {article.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  return (
    <DashboardCard
      title={d.newsTitle}
      link={{ to: '/news', label: d.openPage }}
    >
      {body}
    </DashboardCard>
  );
}
