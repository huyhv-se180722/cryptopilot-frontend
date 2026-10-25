import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, X } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { CommunityFrame } from '../../features/community/components/CommunityFrame';
import {
  FeedToolbar,
  type FeedView,
} from '../../features/community/components/FeedToolbar';
import { MindsharePanel } from '../../features/community/components/MindsharePanel';
import { PostCard } from '../../features/community/components/PostCard';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import {
  LIST_PAGE_SIZE,
  useFeedPage,
  usePinnedPosts,
} from '../../features/community/hooks/use-community';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { FeedTab, MarketType } from '../../types/domain';

const TABS: readonly FeedTab[] = [
  'LATEST',
  'TRENDING',
  'MOST_LIKED',
  'FOLLOWING',
  'SAVED',
  'MINE',
];
const OWN_TABS: readonly FeedTab[] = ['FOLLOWING', 'SAVED', 'MINE'];
const DEFAULT_TAB: FeedTab = 'LATEST';

/**
 * SCR-24 Community feed as CoinMarketCap Community lays it out (D-99):
 * Latest first, newest on top, then For You (the most discussed posts of
 * the week), Most liked (7 days), Following, Saved and My posts, two cards
 * a row and numbered pages; Mindshare; the search of posts and members; the
 * coin list and Top Influencers around it. The announcements are pinned
 * above the first page of Latest (BR-61). Guests read the shared tabs.
 * Tab, page, view and filters live in the URL so a coin links to its feed.
 */
export function CommunityPage() {
  const copy = useCopy();
  const c = copy.community;
  const [params, setParams] = useSearchParams();
  const actions = usePostInteractions();
  const trader = actions.trader;

  const tabs = TABS.filter((t) => trader || !OWN_TABS.includes(t));
  const requested = params.get('tab') as FeedTab | null;
  const tab: FeedTab =
    requested && tabs.includes(requested) ? requested : DEFAULT_TAB;
  const view: FeedView =
    params.get('view') === 'mindshare' ? 'mindshare' : 'posts';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const marketParam = params.get('market');
  const filters = useMemo(
    () => ({
      coin: (params.get('coin') ?? '').toUpperCase(),
      market:
        marketParam === 'spot' || marketParam === 'futures'
          ? (marketParam as MarketType)
          : ('' as const),
      q: params.get('q') ?? '',
    }),
    [params, marketParam],
  );
  const filtered =
    filters.coin !== '' || filters.market !== '' || filters.q !== '';

  // Any change but the page itself starts again from the first page.
  const update = useCallback(
    (next: Record<string, string>) => {
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          if (!('page' in next)) out.delete('page');
          for (const [key, value] of Object.entries(next)) {
            if (
              !value ||
              (key === 'tab' && value === DEFAULT_TAB) ||
              (key === 'view' && value === 'posts') ||
              (key === 'page' && value === '1')
            )
              out.delete(key);
            else out.set(key, value);
          }
          return out;
        },
        { replace: !('page' in next) },
      );
    },
    [setParams],
  );

  const feed = useFeedPage(
    {
      tab,
      ...(filters.coin ? { coin: filters.coin } : {}),
      ...(filters.market ? { market: filters.market } : {}),
      ...(filters.q ? { q: filters.q } : {}),
    },
    page,
    view === 'posts',
  );
  const pinned = usePinnedPosts();
  const posts = feed.data?.items ?? [];
  const showPinned = tab === 'LATEST' && !filtered && page === 1;

  const goTo = (next: number) => {
    update({ page: String(next) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const emptyText =
    tab === 'SAVED'
      ? c.emptySaved
      : tab === 'MINE'
        ? c.emptyMine
        : tab === 'FOLLOWING'
          ? c.emptyFollowing
          : filtered
            ? c.emptyFiltered
            : undefined;

  const chips = [
    ...(filters.coin ? [{ key: 'coin', label: '$' + filters.coin }] : []),
    ...(filters.market
      ? [
          {
            key: 'market',
            label: filters.market === 'spot' ? c.marketSpot : c.marketFutures,
          },
        ]
      : []),
    ...(filters.q ? [{ key: 'q', label: '"' + filters.q + '"' }] : []),
  ];

  return (
    <CommunityFrame actions={actions}>
      {(openComposer) => (
        <>
          <FeedToolbar
            tab={tab}
            tabs={tabs}
            onTab={(next) => update({ tab: next })}
            view={view}
            onView={(next) => update({ view: next })}
            q={filters.q}
            onSearch={(q) => update({ q })}
            trader={trader}
            onNewPost={openComposer}
          />
          {chips.length > 0 && (
            <div
              aria-label={c.filtersLabel}
              className="mb-4 flex flex-wrap items-center gap-2"
            >
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => update({ [chip.key]: '' })}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary-line bg-primary-soft px-3 text-xs font-semibold text-primary"
                >
                  {chip.label}
                  <X size={12} aria-label={c.clearFilters} />
                </button>
              ))}
              {chips.length > 1 && (
                <button
                  type="button"
                  onClick={() => update({ coin: '', market: '', q: '' })}
                  className="text-xs text-muted-x hover:text-fg-2"
                >
                  {c.clearFilters}
                </button>
              )}
            </div>
          )}
          {tab === 'MOST_LIKED' && view === 'posts' && (
            <p className="-mt-2 mb-3 text-[11px] text-muted-dim">
              {c.tabMostLikedHint}
            </p>
          )}
          {view === 'mindshare' ? (
            <MindsharePanel
              onSelect={(coin) => update({ view: 'posts', coin })}
            />
          ) : (
            <div className="grid gap-4">
              {showPinned &&
                pinned.data?.items.map((post) => (
                  <PostCard
                    key={'pinned-' + post.id}
                    post={post}
                    pinned
                    actions={actions}
                  />
                ))}
              {feed.isPending ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[0, 1, 2, 3].map((n) => (
                    <Skeleton key={n} className="h-64 w-full rounded-2xl" />
                  ))}
                </div>
              ) : feed.isError ? (
                <ErrorState
                  message={errorText(copy, feed.error)}
                  onRetry={() => void feed.refetch()}
                />
              ) : posts.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={c.empty}
                  {...(emptyText ? { description: emptyText } : {})}
                />
              ) : (
                <div
                  className={
                    'grid items-start gap-4 transition-opacity duration-150 md:grid-cols-2' +
                    (feed.isPlaceholderData ? ' opacity-60' : '')
                  }
                >
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} actions={actions} />
                  ))}
                </div>
              )}
              {feed.data && (
                <Pagination
                  page={page}
                  total={feed.data.total}
                  pageSize={LIST_PAGE_SIZE}
                  onChange={goTo}
                  disabled={feed.isFetching}
                />
              )}
            </div>
          )}
        </>
      )}
    </CommunityFrame>
  );
}
