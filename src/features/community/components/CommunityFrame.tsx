import { useCallback, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { classNames } from '../../../utils/class-names';
import { CoinDiscussionCard } from './CoinDiscussionCard';
import { CoinPricesProvider } from './CoinPricesProvider';
import { InfluencerList, PinnedCarousel } from './CommunityAside';
import { CommunityNav } from './CommunityNav';
import { JoinCard, RulesCard } from './CommunitySidebar';
import { PostComposerDialog } from './PostComposerDialog';
import { TokenRail } from './TokenRail';
import type { PostActions } from './use-post-interactions';

const RAIL_KEY = 'cp.community.rail-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The page frame of CoinMarketCap Community (D-99): the section bar, then
 * the coin list on the left, the screen in the middle and the right
 * column (the team's pinned posts, Top Influencers, the coin's discussion,
 * the rules). The Post dialog opens from here.
 */
export function CommunityFrame({
  actions,
  children,
}: {
  actions: PostActions;
  children: (openComposer: () => void) => ReactNode;
}) {
  const trader = actions.trader;
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [composing, setComposing] = useState(false);
  const coin = (params.get('coin') ?? '').toUpperCase();

  const collapse = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(RAIL_KEY, next ? '1' : '0');
    } catch {
      // A blocked storage only forgets the choice.
    }
  };

  const select = useCallback(
    (symbol: string) => {
      if (location.pathname !== '/community') {
        navigate(
          '/community' + (symbol ? '?coin=' + encodeURIComponent(symbol) : ''),
        );
        return;
      }
      setParams(
        (current) => {
          const out = new URLSearchParams(current);
          if (symbol) out.set('coin', symbol);
          else out.delete('coin');
          return out;
        },
        { replace: true },
      );
    },
    [location.pathname, navigate, setParams],
  );

  const openComposer = useCallback(
    () => (trader ? setComposing(true) : actions.askToJoin()),
    [trader, actions],
  );

  return (
    <CoinPricesProvider>
      <div className="mx-auto w-full max-w-[1600px]">
        <CommunityNav trader={trader} />
        <div
          className={classNames(
            'grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]',
            collapsed
              ? 'xl:grid-cols-[36px_minmax(0,1fr)_320px]'
              : 'xl:grid-cols-[250px_minmax(0,1fr)_320px]',
          )}
        >
          <aside className="hidden xl:block">
            <TokenRail
              selected={coin}
              onSelect={select}
              trader={trader}
              collapsed={collapsed}
              onCollapse={collapse}
            />
          </aside>
          <div className="min-w-0">{children(openComposer)}</div>
          <aside className="flex flex-col gap-4">
            <PinnedCarousel />
            {coin && <CoinDiscussionCard coin={coin} />}
            <InfluencerList />
            {!trader && actions.role === 'guest' && <JoinCard />}
            <RulesCard />
          </aside>
        </div>
        {trader && (
          <PostComposerDialog
            open={composing}
            onClose={() => setComposing(false)}
            onPublished={() => navigate('/community')}
          />
        )}
        {actions.dialogs}
      </div>
    </CoinPricesProvider>
  );
}
