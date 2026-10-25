import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { useCopy } from '../../../hooks/use-copy';
import type { NewsArticle } from '../../../types/domain';
import { formatInstantUtc } from '../../../utils/instant-format';
import { NewsCover } from './NewsCover';
import {
  SENTIMENT_TONE,
  newsAge,
  newsArticlePath,
  sentimentLabel,
} from './news-format';

/**
 * One SCR-28 item in the style of a news site (D-125): the cover image, the
 * headline, two lines of the AI summary (or the excerpt until there is
 * one), then the source, the publish time, the sentiment chip and the coin
 * tags. The image and the headline open the article's page in the app; a
 * coin tag opens that coin's news.
 */
export function NewsCard({ article }: { article: NewsArticle }) {
  const copy = useCopy();
  const n = copy.news;
  const to = newsArticlePath(article.id);
  return (
    <article className="flex gap-3 rounded-xl border border-line bg-surface p-3 sm:gap-4">
      <Link
        to={to}
        tabIndex={-1}
        aria-hidden="true"
        className="shrink-0 overflow-hidden rounded-lg"
      >
        <NewsCover
          article={article}
          className="h-20 w-28 rounded-lg sm:h-24 sm:w-40"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 text-sm leading-snug font-semibold text-fg sm:text-[15px]">
          <Link to={to} className="text-fg no-underline hover:text-primary">
            {article.title}
          </Link>
        </h2>
        {article.summary && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-2">
            {article.summary}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-dim">
          <span className="font-semibold text-fg-2">{article.source}</span>
          <span aria-hidden="true">·</span>
          <time
            dateTime={article.publishedAt}
            title={formatInstantUtc(article.publishedAt)}
          >
            {newsAge(copy, article.publishedAt)}
          </time>
          {article.sentiment && (
            <Badge tone={SENTIMENT_TONE[article.sentiment]} withDot>
              {sentimentLabel(copy, article.sentiment)}
            </Badge>
          )}
          {article.coins.length > 0 && (
            <ul className="flex flex-wrap gap-1" aria-label={n.coinFilter}>
              {article.coins.map((coin) => (
                <li key={coin.symbol}>
                  <Link
                    to={'/news?coin=' + encodeURIComponent(coin.symbol)}
                    className="rounded-full border border-line bg-raised px-1.5 py-px font-mono text-[10px] text-fg-2 no-underline hover:border-primary-line hover:text-primary"
                  >
                    {coin.symbol}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
