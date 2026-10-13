import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/States';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { useLiveTicker } from '../../features/analysis/hooks/use-live-ticker';
import { AnalysisChart } from '../../features/chart/components/AnalysisChart';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useMarketTickers } from '../../features/market/hooks/use-market-tickers';
import { DemoTradingBanner } from '../../features/paper-trading/components/DemoTradingBanner';
import {
  PairSelector,
  type FavoritePairs,
} from '../../features/paper-trading/components/PairSelector';
import {
  ComingSoon,
  TradePanel,
} from '../../features/paper-trading/components/TradePanel';
import { TradeTickerStrip } from '../../features/paper-trading/components/TradeTickerStrip';
import { useTradeTimeframe } from '../../features/paper-trading/hooks/use-trade-timeframe';
import { useWatchlist } from '../../features/watchlist/hooks/use-watchlist';
import type { MarketPair } from '../../types/domain';
import { classNames } from '../../utils/class-names';

type PhoneRegion = 'chart' | 'book' | 'trades';

/** The trading workspace of one enabled Spot pair. */
function TradeSpot({
  pair,
  pairs,
}: {
  pair: MarketPair;
  pairs: readonly MarketPair[];
}) {
  const copy = useCopy();
  const p = copy.paper;
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useTradeTimeframe();
  const [region, setRegion] = useState<PhoneRegion>('chart');
  const [bottom, setBottom] = useState('open');
  const { ticker, freshness } = useLiveTicker('spot', pair.symbol);
  const symbols = useMemo(() => pairs.map((each) => each.symbol), [pairs]);
  const board = useMarketTickers('spot', symbols);
  const watchlist = useWatchlist();
  const favorites: FavoritePairs = watchlist.isPending
    ? { status: 'loading' }
    : watchlist.isError
      ? { status: 'error', message: errorText(copy, watchlist.error) }
      : {
          status: 'ready',
          symbols: new Set(
            watchlist.data.items
              .filter((item) => item.spotListed)
              .map((item) => item.symbol),
          ),
        };
  // A phone shows one of chart / order book / trades at a time.
  const shown = (name: PhoneRegion) =>
    region === name ? 'flex' : 'hidden md:flex';

  return (
    <>
      <TradeTickerStrip
        pair={pair}
        ticker={ticker}
        freshness={freshness}
        selector={
          <PairSelector
            pairs={pairs}
            tickers={board.tickers}
            favorites={favorites}
            current={pair}
            onSelect={(symbol) => void navigate('/trade/spot/' + symbol)}
          />
        }
      />
      <div className="my-2 md:hidden">
        <SegmentedControl
          label={p.panelsLabel}
          value={region}
          onChange={setRegion}
          options={[
            { value: 'chart', label: p.chartTab },
            { value: 'book', label: p.orderBook },
            { value: 'trades', label: p.marketTrades },
          ]}
        />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <div
          className={classNames(
            shown('chart'),
            'min-w-0 flex-col md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1',
          )}
        >
          <AnalysisChart
            market="spot"
            symbol={pair.symbol}
            tickSize={pair.tickSize}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            extendable
          />
        </div>
        <div
          className={classNames(
            shown('book'),
            'min-h-[320px] flex-col xl:col-start-1 xl:row-span-2 xl:row-start-1',
          )}
        >
          <TradePanel title={p.orderBook} className="flex-1">
            <ComingSoon text={p.soonOrderBook} />
          </TradePanel>
        </div>
        <div
          className={classNames(
            shown('trades'),
            'min-h-[320px] flex-col xl:col-start-3 xl:row-span-2 xl:row-start-1',
          )}
        >
          <TradePanel title={p.marketTrades} className="flex-1">
            <ComingSoon text={p.soonTrades} />
          </TradePanel>
        </div>
        <TradePanel
          title={p.orderForm}
          className="md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-2"
        >
          <ComingSoon text={p.soonForm} />
        </TradePanel>
      </div>
      <TradePanel title={p.ordersAndFunds} className="mt-2">
        <Tabs
          label={p.ordersAndFunds}
          value={bottom}
          onChange={setBottom}
          items={(
            [
              ['open', p.openOrders],
              ['orders', p.orderHistory],
              ['trades', p.tradeHistory],
              ['funds', p.funds],
            ] as const
          ).map(([id, label]) => ({
            id,
            label,
            panel: <ComingSoon text={p.soonPanel} />,
          }))}
        />
      </TradePanel>
    </>
  );
}

/**
 * Spot demo trading (D-86, TR-F1; not in SRS v1.0, no Figma frame): the
 * workspace layout of an exchange's Spot screen with the pair switcher,
 * the instrument strip and the shared chart. The order book, trades,
 * order form and orders panel are filled by TR-F2 and TR-F3. Without a
 * symbol the first pair in display order opens.
 */
export function TradeSpotPage() {
  const copy = useCopy();
  const { symbol = '' } = useParams();
  const pairs = useMarketPairs('spot');
  const pair = pairs.data?.find(
    (candidate) => candidate.symbol === symbol.toUpperCase(),
  );
  const first = pairs.data?.[0];

  if (symbol === '' && first)
    return <Navigate replace to={'/trade/spot/' + first.symbol} />;
  return (
    <div className="w-full">
      <DemoTradingBanner />
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
          {copy.chart.pairUnavailable}{' '}
          {first && (
            <Link to={'/trade/spot/' + first.symbol}>
              {first.baseAsset ?? first.symbol}/{first.quoteAsset ?? ''}
            </Link>
          )}
        </p>
      ) : (
        <TradeSpot key={pair.symbol} pair={pair} pairs={pairs.data} />
      )}
    </div>
  );
}
