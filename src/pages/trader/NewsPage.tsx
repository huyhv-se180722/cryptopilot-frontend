import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { NewsCard } from '../../features/news/components/NewsCard';
import { NewsLocale } from '../../features/news/components/NewsLocale';
import {
  DEFAULT_RANGE,
  NewsFilters,
  type NewsFilterValue,
} from '../../features/news/components/NewsFilters';
import { SENTIMENTS } from '../../features/news/components/news-format';
import {
  NEWS_PAGE_SIZE,
  useNewsFeed,
} from '../../features/news/hooks/use-news';
import { NewsPagination } from '../../features/news/components/NewsPagination';
import { MarketOverview } from '../../features/market/components/MarketOverview';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { NewsRange, NewsSentiment } from '../../types/domain';

const RANGES: readonly NewsRange[] = ['24h', '7d', '30d'];

/**
 * SCR-28 News Feed (SRS 3.8.1, UC-34): aggregated news newest first, with
 * the AI's Vietnamese headline and summary once an article is summarized
 * (D-123), its sentiment and coin tags, the same on every plan (D-122).
 * Filters by coin, sentiment and period live in the URL, so a coin tag or
 * an analysis screen links to its news. The 24-hour count per sentiment is
 * the administrators' (D-126); beside the feed stands a crypto market
 * overview, as a news site has. No Figma frame: the layout follows SCR-24 and SCR-15.
 * Items read like a news site and open their page in the app (D-125); the
 * screen is in Vietnamese like the articles.
 */
export function NewsPage() {
  return (
    <NewsLocale>
      <NewsFeed />
    </NewsLocale>
  );
}

function NewsFeed() {
  const copy = useCopy();
  const n = copy.news;
  const [params, setParams] = useSearchParams();

  const sentimentParam = (params.get('sentiment') ?? '').toUpperCase();
  const rangeParam = (params.get('range') ?? '').toLowerCase();
  const filters: NewsFilterValue = useMemo(
    () => ({
      coin: (params.get('coin') ?? '').toUpperCase(),
      sentiment: SENTIMENTS.includes(sentimentParam as NewsSentiment)
        ? (sentimentParam as NewsSentiment)
        : '',
      range: RANGES.includes(rangeParam as NewsRange)
        ? (rangeParam as NewsRange)
        : DEFAULT_RANGE,
    }),
    [params, sentimentParam, rangeParam],
  );
  const filtered = filters.coin !== '' || filters.sentiment !== '';

  const pageParam = Number(params.get('page') ?? '1');
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const update = useCallback(
    (next: NewsFilterValue) => {
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          // Another filter is another list: it starts at its first page.
          out.delete('page');
          for (const [key, value] of Object.entries(next)) {
            if (!value || (key === 'range' && value === DEFAULT_RANGE))
              out.delete(key);
            else out.set(key, value);
          }
          return out;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const goTo = useCallback(
    (next: number) => {
      setParams((current) => {
        const out = new URLSearchParams(current);
        if (next <= 1) out.delete('page');
        else out.set('page', String(next));
        return out;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setParams],
  );

  const feed = useNewsFeed(
    {
      ...(filters.coin ? { coin: filters.coin } : {}),
      ...(filters.sentiment ? { sentiment: filters.sentiment } : {}),
      range: filters.range,
    },
    page,
  );
  const articles = feed.data?.items ?? [];
  const pages = feed.data
    ? Math.max(1, Math.ceil(feed.data.total / NEWS_PAGE_SIZE))
    : 1;

  const body = feed.isPending ? (
    <div className="grid gap-3">
      {[0, 1, 2].map((k) => (
        <Skeleton key={k} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  ) : feed.isError ? (
    <ErrorState
      message={errorText(copy, feed.error)}
      onRetry={() => void feed.refetch()}
    />
  ) : articles.length === 0 ? (
    <EmptyState
      icon={Newspaper}
      title={n.empty}
      description={filtered ? n.emptyFiltered : n.emptyHint}
    />
  ) : (
    <div className="grid gap-3">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
      <NewsPagination page={page} pages={pages} onChange={goTo} />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title={n.title} description={n.subtitle} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <NewsFilters value={filters} onChange={update} />
          {body}
          <p className="mt-4 text-[11px] text-muted-dim">{n.disclaimer}</p>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <MarketOverview />
        </aside>
      </div>
    </div>
  );
}
