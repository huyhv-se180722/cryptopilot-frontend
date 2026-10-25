import { useMemo, useState } from 'react';
import { ChevronsLeft, ChevronsRight, Flame } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { CoinDiscussion } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  compactDecimal,
  compareDecimal,
  formatPrice,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { useWatchlist } from '../../watchlist/hooks/use-watchlist';
import { useTrendingCoins } from '../hooks/use-community';
import { useCoinPrices, type CoinQuote } from './coin-prices';

type RailTab = 'trending' | 'top' | 'watchlist';

const ROWS = 15;

/**
 * The left column of CoinMarketCap Community, "Showing Posts of:" (D-99):
 * the coins the week's posts talk about, the Spot pairs by 24h volume, or
 * the Trader's watchlist, each with its live price and 24h change.
 * Choosing a coin filters the feed by it; choosing it again clears it.
 */
export function TokenRail({
  selected,
  onSelect,
  trader,
  collapsed,
  onCollapse,
}: {
  selected: string;
  onSelect: (coin: string) => void;
  trader: boolean;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}) {
  const c = useCopy().community;
  const [tab, setTab] = useState<RailTab>('trending');
  const { quotes } = useCoinPrices();
  const trending = useTrendingCoins();
  const watchlist = useWatchlist(trader);

  const rows = useMemo((): readonly {
    quote: CoinQuote;
    discussion?: CoinDiscussion;
  }[] => {
    if (tab === 'trending')
      return (trending.data ?? []).flatMap((discussion) => {
        const quote = quotes.get(discussion.symbol);
        return quote ? [{ quote, discussion }] : [];
      });
    if (tab === 'watchlist')
      return (watchlist.data?.items ?? []).flatMap((item) => {
        const quote = [...quotes.values()].find(
          (q) => q.pair.symbol === item.symbol,
        );
        return quote ? [{ quote }] : [];
      });
    return [...quotes.values()]
      .map((quote) => ({ quote }))
      .sort((a, b) =>
        compareDecimal(
          b.quote.ticker?.quoteVolume24h ?? '0',
          a.quote.ticker?.quoteVolume24h ?? '0',
        ),
      );
  }, [tab, trending.data, watchlist.data, quotes]);

  if (collapsed)
    return (
      <button
        type="button"
        onClick={() => onCollapse(false)}
        aria-label={c.railExpand}
        title={c.railExpand}
        className="sticky top-16 hidden size-9 items-center justify-center rounded-lg border border-line bg-surface text-muted-x hover:text-fg-2 xl:inline-flex"
      >
        <ChevronsRight size={15} aria-hidden="true" />
      </button>
    );

  const loading =
    quotes.size === 0 ||
    (tab === 'trending' && trending.isPending) ||
    (tab === 'watchlist' && trader && watchlist.isPending);
  const tabs: readonly { id: RailTab; label: string }[] = [
    { id: 'trending', label: c.railTrending },
    { id: 'top', label: c.railTop },
    { id: 'watchlist', label: c.railWatchlist },
  ];

  return (
    <section
      aria-label={c.railLabel}
      className="sticky top-16 hidden max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface xl:flex"
    >
      <div className="flex items-center justify-between px-3 pt-3">
        <h2 className="text-sm font-semibold text-fg">{c.railTitle}</h2>
        <button
          type="button"
          onClick={() => onCollapse(true)}
          aria-label={c.railCollapse}
          title={c.railCollapse}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-x hover:bg-raised hover:text-fg-2"
        >
          <ChevronsLeft size={14} aria-hidden="true" />
        </button>
      </div>
      <div role="tablist" className="flex gap-1 px-3 pt-2 pb-2.5">
        {tabs.map((each) => (
          <button
            key={each.id}
            type="button"
            role="tab"
            aria-selected={tab === each.id}
            onClick={() => setTab(each.id)}
            className={classNames(
              'h-6 rounded-md px-2 text-[11px] font-semibold transition-colors duration-150',
              tab === each.id
                ? 'border border-primary-line bg-primary-soft text-primary'
                : 'text-muted-x hover:text-fg-2',
            )}
          >
            {each.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between border-y border-line px-3 py-1.5 text-[10px] text-muted-x">
        <span>{c.railToken}</span>
        <span>{c.railPrice}</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          [0, 1, 2, 3, 4, 5].map((n) => (
            <li key={n} className="px-3 py-2">
              <Skeleton className="h-8 w-full" />
            </li>
          ))
        ) : tab === 'watchlist' && !trader ? (
          <li className="px-3 py-4 text-xs text-muted-dim">
            {c.railWatchlistGuest}
          </li>
        ) : rows.length === 0 ? (
          <li className="px-3 py-4 text-xs text-muted-dim">
            {tab === 'watchlist' ? c.railWatchlistEmpty : c.railEmpty}
          </li>
        ) : (
          rows.slice(0, ROWS).map(({ quote, discussion }, index) => (
            <li key={quote.coin}>
              <RailRow
                rank={index + 1}
                quote={quote}
                discussion={discussion}
                active={selected === quote.coin}
                onSelect={() =>
                  onSelect(selected === quote.coin ? '' : quote.coin)
                }
              />
            </li>
          ))
        )}
      </ol>
      {selected && (
        <button
          type="button"
          onClick={() => onSelect('')}
          className="border-t border-line px-3 py-2 text-left text-[11px] font-semibold text-primary hover:bg-raised"
        >
          {c.railClear}
        </button>
      )}
    </section>
  );
}

function RailRow({
  rank,
  quote,
  discussion,
  active,
  onSelect,
}: {
  rank: number;
  quote: CoinQuote;
  discussion: CoinDiscussion | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  const c = useCopy().community;
  const ticker = quote.ticker;
  const change = ticker?.changePercent24h ?? null;
  const up = change !== null && !change.startsWith('-');
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      title={
        discussion
          ? formatCopy(c.railPosts, { n: discussion.postsLastWeek })
          : undefined
      }
      className={classNames(
        'grid w-full grid-cols-[18px_24px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left transition-colors duration-150',
        active ? 'bg-primary-soft' : 'hover:bg-raised',
      )}
    >
      <span className="text-[11px] text-muted-x">{rank}</span>
      {quote.pair.logoUrl ? (
        <img src={quote.pair.logoUrl} alt="" className="size-6 rounded-full" />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full bg-raised text-[9px] font-bold text-fg-2"
        >
          {quote.coin.slice(0, 3)}
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1 truncate text-xs font-semibold text-fg">
          {quote.coin}
          {discussion && discussion.postsLastDay > 0 && (
            <Flame size={11} aria-hidden="true" className="text-accent" />
          )}
        </span>
        <span className="block truncate text-[10px] text-muted-x">
          {ticker?.quoteVolume24h
            ? '$' + compactDecimal(ticker.quoteVolume24h)
            : '—'}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-mono text-xs text-fg">
          {ticker?.lastPrice
            ? '$' + formatPrice(ticker.lastPrice, quote.pair.tickSize)
            : '—'}
        </span>
        {change !== null && (
          <span
            className={classNames(
              'block font-mono text-[10px]',
              up ? 'text-positive' : 'text-negative',
            )}
          >
            {up ? '▲' : '▼'} {toFixedDecimal(change.replace(/^-/, ''), 2)}%
          </span>
        )}
      </span>
    </button>
  );
}
