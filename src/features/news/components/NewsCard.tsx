import { Link } from 'react-router-dom';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { NewsArticle } from '../../../types/domain';
import { formatInstantUtc } from '../../../utils/instant-format';
import { SENTIMENT_TONE, newsAge, sentimentLabel } from './news-format';

/**
 * One SCR-28 item (SRS 3.8.1): title, source, publish time, coin tags, the
 * AI summary (or the excerpt until there is one) and the sentiment chip.
 * The headline opens the original article in a new tab; a coin tag opens
 * that coin's news.
 */
export function NewsCard({ article }: { article: NewsArticle }) {
  const copy = useCopy();
  const n = copy.news;
  const translated = article.title !== article.originalTitle;
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-dim">
        <span className="font-semibold text-fg-2">{article.source}</span>
        <span aria-hidden="true">·</span>
        <time
          dateTime={article.publishedAt}
          title={formatInstantUtc(article.publishedAt)}
        >
          {newsAge(copy, article.publishedAt)}
        </time>
        {article.sentiment && (
          <span className="ml-auto">
            <Badge tone={SENTIMENT_TONE[article.sentiment]} withDot>
              {sentimentLabel(copy, article.sentiment)}
            </Badge>
          </span>
        )}
      </div>
      <h2 className="text-sm leading-snug font-semibold text-fg">
        <a
          href={article.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-fg no-underline hover:text-primary"
        >
          {article.title}
          <ExternalLink
            size={12}
            aria-hidden="true"
            className="ml-1 inline align-baseline text-muted-x"
          />
        </a>
      </h2>
      {translated && (
        <p className="mt-1 text-[11px] text-muted-dim">
          {formatCopy(n.originalTitle, { title: article.originalTitle })}
        </p>
      )}
      {article.summary && (
        <p className="mt-2 text-xs leading-relaxed text-fg-2">
          {article.aiSummarized && (
            <span className="mr-1.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-primary uppercase">
              <Sparkles size={11} aria-hidden="true" />
              {n.aiSummary}
            </span>
          )}
          {article.summary}
        </p>
      )}
      {article.coins.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={n.coinFilter}>
          {article.coins.map((coin) => (
            <li key={coin.symbol}>
              <Link
                to={'/news?coin=' + encodeURIComponent(coin.symbol)}
                className="rounded-full border border-line bg-raised px-2 py-0.5 font-mono text-[11px] text-fg-2 no-underline hover:border-primary-line hover:text-primary"
              >
                {coin.symbol}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
