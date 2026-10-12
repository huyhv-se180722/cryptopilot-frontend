import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ErrorState } from '../../../components/feedback/States';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import type { MarketPair, MarketType } from '../../../types/domain';
import type { MarketBoardData } from '../hooks/use-market-board';
import { FreshnessBadge } from './FreshnessBadge';
import { MarketTable } from './MarketTable';

function matches(pair: MarketPair, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [pair.symbol, pair.baseAsset, pair.baseAssetName].some((value) =>
    value?.toLowerCase().includes(needle),
  );
}

function TableSkeleton() {
  const copy = useCopy();
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <span className="sr-only">{copy.common.loading}</span>
      <div className="h-9 border-b border-line bg-page-alt" />
      {Array.from({ length: 6 }, (_, row) => (
        <div
          key={row}
          className="flex h-14 items-center gap-4 border-b border-line px-4 last:border-b-0"
        >
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-3 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

/**
 * Spot / Futures pair list with search and live prices (SCR-01, SCR-09).
 * The pair list comes from REST; prices from the overview topic, polled
 * while Delayed (CR-09).
 */
export function MarketBoard({
  board,
  onMarketChange,
  selectedSymbol,
  onSelect,
  hrefOf,
}: {
  board: MarketBoardData;
  onMarketChange: (market: MarketType) => void;
  selectedSymbol?: string | null;
  onSelect?: (pair: MarketPair) => void;
  hrefOf?: (pair: MarketPair) => string;
}) {
  const copy = useCopy();
  const m = copy.market;
  const [query, setQuery] = useState('');
  const { market, pairs, all, tickers, freshness, now } = board;
  const shown = useMemo(
    () => all.filter((pair) => matches(pair, query)),
    [all, query],
  );

  return (
    <section aria-label={m.tabsLabel}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label={m.tabsLabel}
          value={market}
          onChange={onMarketChange}
          options={[
            { value: 'spot', label: m.spot },
            { value: 'futures', label: m.futures },
          ]}
        />
        <label className="relative flex min-w-0 flex-1 basis-48 items-center sm:max-w-xs">
          <span className="sr-only">{m.searchLabel}</span>
          <Search
            size={13}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-muted-dim"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={m.searchPlaceholder}
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-xs text-fg placeholder:text-muted-dim focus:border-primary focus:outline-none pointer-coarse:h-11"
          />
        </label>
        <span className="ml-auto flex items-center gap-3">
          {pairs.data && (
            <span className="hidden text-[11px] text-muted-dim sm:inline">
              {formatCopy(m.pairCount, { count: all.length })}
            </span>
          )}
          <FreshnessBadge freshness={freshness} />
        </span>
      </div>
      {pairs.isPending ? (
        <TableSkeleton />
      ) : pairs.isError ? (
        <ErrorState
          message={errorText(copy, pairs.error)}
          onRetry={() => void pairs.refetch()}
        />
      ) : (
        <MarketTable
          market={market}
          pairs={shown}
          tickers={tickers}
          now={now}
          selectedSymbol={selectedSymbol ?? null}
          emptyMessage={messageText(copy, 'MSG41')}
          {...(onSelect ? { onSelect } : {})}
          {...(hrefOf ? { hrefOf } : {})}
        />
      )}
    </section>
  );
}
