import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileQuestion, Sparkles } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Badge } from '../../components/ui/Badge';
import { buttonClassName } from '../../components/ui/button-styles';
import { Skeleton } from '../../components/ui/Skeleton';
import { NewsCover } from '../../features/news/components/NewsCover';
import { NewsLocale } from '../../features/news/components/NewsLocale';
import {
  SENTIMENT_TONE,
  newsParagraphs,
  sentimentLabel,
} from '../../features/news/components/news-format';
import { useNewsArticle } from '../../features/news/hooks/use-news';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../utils/instant-format';

/**
 * An article of SCR-28 read in the app, in the style of a news site
 * (D-125): source, time and sentiment, the Vietnamese headline, the cover
 * image shown from the outlet, the article the AI wrote again in its own
 * words (its summary until then), and at the end the source with a link to
 * the original in a new tab. The full original text is never stored
 * (BR-48). Rendered in Vietnamese like the feed.
 */
export function NewsArticlePage() {
  return (
    <NewsLocale>
      <NewsArticle />
    </NewsLocale>
  );
}

function NewsArticle() {
  const { articleId = '' } = useParams();
  const copy = useCopy();
  const n = copy.news;
  const article = useNewsArticle(articleId);

  const back = (
    <Link
      to="/news"
      className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
    >
      <ArrowLeft size={13} aria-hidden="true" />
      {n.backToNews}
    </Link>
  );

  if (article.isPending)
    return (
      <div className="mx-auto w-full max-w-3xl">
        {back}
        <Skeleton className="mb-4 h-8 w-3/4 rounded-lg" />
        <Skeleton className="mb-6 aspect-[16/9] w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );

  if (article.isError) {
    const notFound =
      (article.error as { status?: number } | null)?.status === 404;
    return (
      <div className="mx-auto w-full max-w-3xl">
        {back}
        {notFound ? (
          <EmptyState
            icon={FileQuestion}
            title={n.articleNotFound}
            description={n.articleNotFoundHint}
            action={
              <Link to="/news" className={buttonClassName('secondary')}>
                {n.backToNews}
              </Link>
            }
          />
        ) : (
          <ErrorState
            message={errorText(copy, article.error)}
            onRetry={() => void article.refetch()}
          />
        )}
      </div>
    );
  }

  const data = article.data;
  const translated = data.title !== data.originalTitle;
  const paragraphs = data.body ? newsParagraphs(data.body) : [];

  return (
    <div className="mx-auto w-full max-w-3xl">
      {back}
      <article aria-labelledby="news-article-title">
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-dim">
          <span className="font-semibold text-fg-2">{data.source}</span>
          <span aria-hidden="true">·</span>
          <time
            dateTime={data.publishedAt}
            title={formatInstantUtc(data.publishedAt)}
          >
            {formatCopy(n.publishedOn, {
              date: formatInstantLocal(data.publishedAt),
            })}
          </time>
          {data.sentiment && (
            <Badge tone={SENTIMENT_TONE[data.sentiment]} withDot>
              {sentimentLabel(copy, data.sentiment)}
            </Badge>
          )}
        </div>
        <h1
          id="news-article-title"
          className="text-xl leading-tight font-bold text-fg sm:text-2xl"
        >
          {data.title}
        </h1>
        {translated && (
          <p className="mt-2 text-xs text-muted-dim">
            {formatCopy(n.originalTitle, { title: data.originalTitle })}
          </p>
        )}
        {data.coins.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={n.coinFilter}>
            {data.coins.map((coin) => (
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

        <figure className="my-5">
          <NewsCover
            article={data}
            eager
            className="aspect-[16/9] w-full rounded-xl"
          />
          {data.imageUrl && (
            <figcaption className="mt-1.5 text-[11px] text-muted-dim">
              {formatCopy(n.imageCredit, { source: data.source })}
            </figcaption>
          )}
        </figure>

        <div className="grid gap-4 text-[15px] leading-relaxed text-fg-2">
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          ) : (
            <>
              {data.aiSummarized && (
                <p className="text-xs text-muted-dim italic">{n.bodyPending}</p>
              )}
              {data.summary && <p>{data.summary}</p>}
            </>
          )}
        </div>

        <footer className="mt-8 rounded-xl border border-line bg-surface p-4">
          <p className="text-[11px] font-semibold tracking-wide text-muted-dim uppercase">
            {n.sourceLabel}
          </p>
          <p className="mt-1 text-sm font-semibold text-fg">{data.source}</p>
          <p className="mt-0.5 text-xs text-muted-dim">{data.originalTitle}</p>
          <a
            href={data.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName('secondary', 'sm', 'mt-3 gap-1.5')}
          >
            {n.readOriginal}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </footer>

        {data.aiSummarized && (
          <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-dim">
            <Sparkles
              size={12}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary"
            />
            {n.aiRewritten}
          </p>
        )}
      </article>
    </div>
  );
}
