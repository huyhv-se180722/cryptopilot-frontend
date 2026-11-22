import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ErrorState } from '../../../components/feedback/States';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { errorText } from '../../../i18n/messages';
import { sortCoins, type CoinSort, type CoinSortKey } from '../coin-market';
import { useCoinMarket } from '../hooks/use-coin-market';
import {
  CommunityCard,
  DerivativesCard,
  MarketStatusCard,
  TrendingCard,
} from './CoinMarketCards';
import { CoinMarketTable } from './CoinMarketTable';
import { FreshnessBadge } from './FreshnessBadge';

type View = 'top' | 'gainers' | 'losers';

const VIEW_SORT: Record<View, CoinSort> = {
  top: { key: 'rank', descending: false },
  gainers: { key: 'change24h', descending: true },
  losers: { key: 'change24h', descending: false },
};

/**
 * SCR-09 Market List as one list of coins, Spot and Futures together: the
 * market's figures in four cards above (status, trending, derivatives,
 * community), then every listed coin with live prices.
 */
export function CoinMarketBoard() {
  const copy = useCopy();
  const c = copy.coinMarket;
  const board = useCoinMarket();
  const [view, setView] = useState<View>('top');
  const [sort, setSort] = useState<CoinSort>(VIEW_SORT.top);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? board.rows.filter((row) =>
          [row.coin.symbol, row.coin.name].some((text) =>
            text.toLowerCase().includes(needle),
          ),
        )
      : board.rows;
    return sortCoins(matching, sort);
  }, [board.rows, query, sort]);

  const onSort = (key: CoinSortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, descending: !current.descending }
        : { key, descending: key !== 'rank' && key !== 'name' },
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MarketStatusCard data={board.data} />
        <TrendingCard rows={board.rows} loading={board.isPending} />
        <DerivativesCard
          data={board.data}
          futuresVolume={board.futuresVolume}
          futuresSymbol={
            board.rows.find((row) => row.coin.futuresSymbol)?.coin
              .futuresSymbol ?? null
          }
        />
        <CommunityCard now={now} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label={c.tabsLabel}
          value={view}
          onChange={(next: View) => {
            setView(next);
            setSort(VIEW_SORT[next]);
          }}
          options={[
            { value: 'top', label: c.tabTop },
            { value: 'gainers', label: c.tabGainers },
            { value: 'losers', label: c.tabLosers },
          ]}
        />
        <FreshnessBadge freshness={board.freshness} />
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">{c.searchLabel}</span>
          <Search
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-dim"
          />
          <input
            type="search"
            value={query}
            placeholder={c.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-raised pr-3 pl-9 text-xs text-fg placeholder:text-muted-dim focus:border-primary-line focus:outline-none"
          />
        </label>
      </div>

      {board.error ? (
        <ErrorState
          message={errorText(copy, board.error)}
          onRetry={board.refetch}
        />
      ) : board.isPending ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">{copy.common.loading}</span>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface py-10 text-center text-sm text-muted">
          {c.empty}
        </p>
      ) : (
        <CoinMarketTable rows={shown} sort={sort} onSort={onSort} />
      )}
      <p className="text-xs text-muted-x">{c.sources}</p>
    </div>
  );
}
