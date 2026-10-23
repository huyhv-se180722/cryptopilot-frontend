import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, PenSquare, Users } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { buttonClassName } from '../../components/ui/button-styles';
import { CoinDiscussionCard } from '../../features/community/components/CoinDiscussionCard';
import {
  JoinCard,
  RulesCard,
} from '../../features/community/components/CommunitySidebar';
import {
  FeedFilters,
  type FeedFilterValue,
} from '../../features/community/components/FeedFilters';
import { PostCard } from '../../features/community/components/PostCard';
import { usePostInteractions } from '../../features/community/components/use-post-interactions';
import {
  useFeed,
  usePinnedPosts,
} from '../../features/community/hooks/use-community';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { FeedTab, MarketType } from '../../types/domain';

const TABS: readonly FeedTab[] = ['LATEST', 'MOST_LIKED', 'SAVED', 'MINE'];
const OWN_TABS: readonly FeedTab[] = ['SAVED', 'MINE'];

/**
 * SCR-24 Community feed (SRS 3.7.1, UC-26): Latest, Most liked (7 days),
 * Saved and My posts, filters by coin and market, search (D-99), the
 * announcements pinned on top (BR-61). Guests read the shared tabs (D-99).
 * Tab and filters live in the URL so a coin chip links to its feed.
 */
export function CommunityPage() {
  const copy = useCopy();
  const c = copy.community;
  const [params, setParams] = useSearchParams();
  const actions = usePostInteractions();
  const trader = actions.trader;

  const requested = params.get('tab') as FeedTab | null;
  const tab: FeedTab =
    requested &&
    TABS.includes(requested) &&
    (trader || !OWN_TABS.includes(requested))
      ? requested
      : 'LATEST';
  const marketParam = params.get('market');
  const filters: FeedFilterValue = useMemo(
    () => ({
      coin: (params.get('coin') ?? '').toUpperCase(),
      market:
        marketParam === 'spot' || marketParam === 'futures'
          ? (marketParam as MarketType)
          : '',
      q: params.get('q') ?? '',
    }),
    [params, marketParam],
  );
  const filtered =
    filters.coin !== '' || filters.market !== '' || filters.q !== '';

  const update = useCallback(
    (next: Partial<FeedFilterValue & { tab: FeedTab }>) => {
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          for (const [key, value] of Object.entries(next)) {
            if (!value || (key === 'tab' && value === 'LATEST'))
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

  const feed = useFeed({
    tab,
    ...(filters.coin ? { coin: filters.coin } : {}),
    ...(filters.market ? { market: filters.market } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  });
  const pinned = usePinnedPosts();
  const posts = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const showPinned = tab === 'LATEST' && !filtered;

  const emptyText =
    tab === 'SAVED'
      ? c.emptySaved
      : tab === 'MINE'
        ? c.emptyMine
        : filtered
          ? c.emptyFiltered
          : undefined;

  const list = (
    <div className="grid gap-3">
      {showPinned &&
        pinned.data?.items.map((post) => (
          <PostCard
            key={'pinned-' + post.id}
            post={post}
            pinned
            menu={actions.menu(post)}
            onReact={(action, active) =>
              void actions.react(post.id, action, active)
            }
            pending={actions.reacting}
          />
        ))}
      {feed.isPending ? (
        [0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-40 w-full rounded-2xl" />
        ))
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
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            menu={actions.menu(post)}
            onReact={(action, active) =>
              void actions.react(post.id, action, active)
            }
            pending={actions.reacting}
          />
        ))
      )}
      {feed.hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button
            variant="secondary"
            disabled={feed.isFetchingNextPage}
            onClick={() => void feed.fetchNextPage()}
          >
            {c.loadMore}
          </Button>
        </div>
      )}
    </div>
  );

  const tabItems = TABS.filter((t) => trader || !OWN_TABS.includes(t)).map(
    (id) => ({
      id,
      label: {
        LATEST: c.tabLatest,
        MOST_LIKED: c.tabMostLiked,
        SAVED: c.tabSaved,
        MINE: c.tabMine,
      }[id],
      // Only the open tab holds the feed: the others are hidden panels.
      panel: id === tab && (
        <>
          <FeedFilters
            value={filters}
            onChange={(value) => update({ ...value })}
          />
          {id === 'MOST_LIKED' && (
            <p className="mb-3 text-[11px] text-muted-dim">
              {c.tabMostLikedHint}
            </p>
          )}
          {list}
        </>
      ),
    }),
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={c.title}
        description={trader ? c.subtitle : c.guestSubtitle}
        actions={
          trader ? (
            <Link to="/community/new" className={buttonClassName()}>
              <PenSquare size={14} aria-hidden="true" />
              {c.newPost}
            </Link>
          ) : (
            <Button variant="secondary" onClick={actions.askToJoin}>
              <Users size={14} aria-hidden="true" />
              {c.newPost}
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <Tabs
            label={c.tabsLabel}
            items={tabItems}
            value={tab}
            onChange={(id) => update({ tab: id as FeedTab })}
          />
        </div>
        <aside className="flex flex-col gap-4">
          {filters.coin && <CoinDiscussionCard coin={filters.coin} />}
          {!trader && actions.role === 'guest' && <JoinCard />}
          <RulesCard />
        </aside>
      </div>
      {actions.dialogs}
    </div>
  );
}
