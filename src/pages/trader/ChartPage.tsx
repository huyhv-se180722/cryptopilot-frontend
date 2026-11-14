import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { useLiveTicker } from '../../features/analysis/hooks/use-live-ticker';
import { AnalysisChart } from '../../features/chart/components/AnalysisChart';
import {
  readLastChartPair,
  useRememberChartPair,
} from '../../features/chart/hooks/use-last-chart-pair';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useMarketTickers } from '../../features/market/hooks/use-market-tickers';
import {
  PairSelector,
  type FavoritePairs,
} from '../../features/paper-trading/components/PairSelector';
import { useTradeTimeframe } from '../../features/paper-trading/hooks/use-trade-timeframe';
import { useWatchlist } from '../../features/watchlist/hooks/use-watchlist';
import type { MarketPair, MarketType } from '../../types/domain';
import { classNames } from '../../utils/class-names';
import { formatPrice, toFixedDecimal } from '../../utils/decimal-format';

const MARKETS: readonly MarketType[] = ['spot', 'futures'];

/** Whether the browser shows `element` full screen. */
function useFullscreen(element: React.RefObject<HTMLElement | null>) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () =>
      setFull(
        document.fullscreenElement !== null &&
          document.fullscreenElement === element.current,
      );
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [element]);
  const toggle = () => {
    const target = element.current;
    if (!target) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void target.requestFullscreen?.();
  };
  return [full, toggle] as const;
}

function ChartScreen({
  market,
  pair,
  pairs,
}: {
  market: MarketType;
  pair: MarketPair;
  pairs: readonly MarketPair[];
}) {
  const copy = useCopy();
  const c = copy.chartPage;
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useTradeTimeframe();
  const frame = useRef<HTMLDivElement>(null);
  const [full, toggleFull] = useFullscreen(frame);
  const { ticker } = useLiveTicker(market, pair.symbol);
  const symbols = useMemo(() => pairs.map((each) => each.symbol), [pairs]);
  const board = useMarketTickers(market, symbols);
  const watchlist = useWatchlist();
  useRememberChartPair(market, pair.symbol);
  const favorites: FavoritePairs = watchlist.isPending
    ? { status: 'loading' }
    : watchlist.isError
      ? { status: 'error', message: errorText(copy, watchlist.error) }
      : {
          status: 'ready',
          symbols: new Set(
            watchlist.data.items
              .filter((item) =>
                market === 'spot' ? item.spotListed : item.futuresListed,
              )
              .map((item) => item.symbol),
          ),
        };
  const change = ticker?.changePercent24h ?? null;

  return (
    <div
      ref={frame}
      className={classNames(
        'flex w-full flex-col gap-3 bg-page',
        full && 'h-screen overflow-auto p-4',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <PairSelector
          pairs={pairs}
          tickers={board.tickers}
          favorites={favorites}
          current={pair}
          onSelect={(symbol) => void navigate(`/chart/${market}/${symbol}`)}
        />
        <SegmentedControl
          label={c.marketLabel}
          value={market}
          onChange={(next) => void navigate(`/chart/${next}`)}
          options={MARKETS.map((value) => ({
            value,
            label: value === 'spot' ? c.spot : c.futures,
          }))}
        />
        {ticker?.lastPrice && (
          <span className="font-mono text-sm text-fg">
            {formatPrice(ticker.lastPrice, pair.tickSize)}
          </span>
        )}
        {change !== null && (
          <span
            className={classNames(
              'font-mono text-xs',
              change.startsWith('-') ? 'text-negative' : 'text-positive',
            )}
          >
            {(change.startsWith('-') ? '' : '+') + toFixedDecimal(change, 2)}%
          </span>
        )}
        <button
          type="button"
          aria-label={full ? c.exitFullscreen : c.fullscreen}
          title={full ? c.exitFullscreen : c.fullscreen}
          aria-pressed={full}
          onClick={toggleFull}
          className="ml-auto inline-flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-raised hover:text-fg-2"
        >
          {full ? (
            <Minimize2 size={16} aria-hidden="true" />
          ) : (
            <Maximize2 size={16} aria-hidden="true" />
          )}
        </button>
      </div>
      <AnalysisChart
        market={market}
        symbol={pair.symbol}
        tickSize={pair.tickSize}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        extendable
        height={
          full ? 'h-[calc(100vh-150px)]' : 'h-[calc(100vh-260px)] min-h-[420px]'
        }
        drawingPairId={pair.pairId}
      />
    </div>
  );
}

/**
 * The Chart screen (D-149, T-123): a large chart of one pair for technical
 * analysis, like an exchange's full chart page, with the drawing tools and
 * no order entry. The pair and market are picked on the screen and
 * remembered on the device; drawings are the same as on the analysis and
 * trading screens of the pair.
 */
export function ChartPage() {
  const copy = useCopy();
  const { market: rawMarket = '', symbol = '' } = useParams();
  const known = MARKETS.find((each) => each === rawMarket);
  const market: MarketType = known ?? 'spot';
  const pairs = useMarketPairs(market);
  const last = readLastChartPair();

  if (rawMarket === '')
    return (
      <Navigate
        replace
        to={last ? `/chart/${last.market}/${last.symbol}` : '/chart/spot'}
      />
    );
  if (!known) return <Navigate replace to="/chart/spot" />;

  const pair = pairs.data?.find(
    (candidate) => candidate.symbol === symbol.toUpperCase(),
  );
  const first = pairs.data?.[0];
  if (symbol === '' && first) {
    const reopen =
      (last?.market === market &&
        pairs.data?.find((candidate) => candidate.symbol === last.symbol)) ||
      first;
    return <Navigate replace to={`/chart/${market}/${reopen.symbol}`} />;
  }

  return (
    <div className="w-full">
      <h1 className="sr-only">{copy.screens.chart}</h1>
      {pairs.isPending ? (
        <Skeleton className="h-[560px] w-full" />
      ) : pairs.isError ? (
        <ErrorState
          message={errorText(copy, pairs.error)}
          onRetry={() => void pairs.refetch()}
        />
      ) : !pair ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-muted"
        >
          {market === 'spot'
            ? copy.chart.pairUnavailable
            : copy.chart.pairUnavailableFutures}{' '}
          {first && (
            <Link to={`/chart/${market}/${first.symbol}`}>
              {first.baseAsset ?? first.symbol}/{first.quoteAsset ?? ''}
            </Link>
          )}
        </p>
      ) : (
        <ChartScreen market={market} pair={pair} pairs={pairs.data ?? []} />
      )}
    </div>
  );
}
