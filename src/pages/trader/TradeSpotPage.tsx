import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/States';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { useLiveTicker } from '../../features/analysis/hooks/use-live-ticker';
import { AnalysisChart } from '../../features/chart/components/AnalysisChart';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useMarketTickers } from '../../features/market/hooks/use-market-tickers';
import {
  useMarketTrades,
  useOrderBook,
} from '../../features/market/hooks/use-order-book';
import { MarketTradesPanel } from '../../features/paper-trading/components/MarketTradesPanel';
import { OrderBookPanel } from '../../features/paper-trading/components/OrderBookPanel';
import { DemoTradingBanner } from '../../features/paper-trading/components/DemoTradingBanner';
import {
  PairSelector,
  type FavoritePairs,
} from '../../features/paper-trading/components/PairSelector';
import { OrdersPanel } from '../../features/paper-trading/components/OrdersPanel';
import {
  SpotOrderForm,
  type PickedPrice,
} from '../../features/paper-trading/components/SpotOrderForm';
import { TradePanel } from '../../features/paper-trading/components/TradePanel';
import { TradeTickerStrip } from '../../features/paper-trading/components/TradeTickerStrip';
import { usePaperAccount } from '../../features/paper-trading/hooks/use-paper-account';
import { usePaperWallet } from '../../features/paper-trading/hooks/use-paper-orders';
import { useTradeTimeframe } from '../../features/paper-trading/hooks/use-trade-timeframe';
import {
  useWatchedPair,
  useWatchlist,
} from '../../features/watchlist/hooks/use-watchlist';
import type { Decimal, MarketPair } from '../../types/domain';
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
  const [picked, setPicked] = useState<PickedPrice | null>(null);
  const pick = (price: Decimal) => setPicked({ price, at: Date.now() });
  // Demo orders name the pair by id, which only a watchlist row carries
  // until the market list gives it (FEQ-01).
  const pairId = useWatchedPair(pair.symbol)?.pairId ?? null;
  const spot = usePaperWallet('SPOT');
  const account = usePaperAccount();
  const balance = (asset: string) =>
    spot.data?.balances.find((row) => row.asset === asset)?.free ?? '0';
  const funds = spot.data
    ? {
        quote: balance(pair.quoteAsset ?? ''),
        base: balance(pair.baseAsset ?? ''),
      }
    : null;
  const { ticker, freshness } = useLiveTicker('spot', pair.symbol);
  const book = useOrderBook('spot', pair.symbol);
  const trades = useMarketTrades('spot', pair.symbol);
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
          <OrderBookPanel
            pair={pair}
            stream={book}
            lastPrice={ticker?.lastPrice ?? null}
            onPickPrice={pick}
            className="flex-1"
          />
        </div>
        <div
          className={classNames(
            shown('trades'),
            // The list scrolls inside: 50 rows would outgrow the row.
            'h-[560px] flex-col xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:h-auto',
          )}
        >
          <MarketTradesPanel
            pair={pair}
            stream={trades}
            onPickPrice={pick}
            className="min-h-0 flex-1"
          />
        </div>
        <TradePanel
          title={p.orderForm}
          className="md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-2"
        >
          <SpotOrderForm
            key={pair.symbol}
            pair={pair}
            pairId={pairId}
            lastPrice={ticker?.lastPrice ?? null}
            picked={picked}
            funds={funds}
            unavailable={
              account.isError ? errorText(copy, account.error) : null
            }
          />
        </TradePanel>
      </div>
      <OrdersPanel pair={pair} pairId={pairId} pairs={pairs} />
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
