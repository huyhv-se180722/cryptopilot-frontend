import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { buttonClassName } from '../../components/ui/button-styles';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { useFeature } from '../../hooks/use-entitlement';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText, messageText } from '../../i18n/messages';
import { useLiveTicker } from '../../features/analysis/hooks/use-live-ticker';
import { AnalysisChart } from '../../features/chart/components/AnalysisChart';
import { AccountMarginPanel } from '../../features/futures-trading/components/AccountMarginPanel';
import { FuturesBottomPanel } from '../../features/futures-trading/components/FuturesBottomPanel';
import { FuturesOrderForm } from '../../features/futures-trading/components/FuturesOrderForm';
import { FuturesSettingsBar } from '../../features/futures-trading/components/FuturesSettingsBar';
import { FuturesTickerStrip } from '../../features/futures-trading/components/FuturesTickerStrip';
import {
  useFuturesAccount,
  useFuturesBrackets,
  useFuturesPositionMode,
  useFuturesPositions,
  useFuturesPush,
  useFuturesSymbolConfig,
} from '../../features/futures-trading/hooks/use-futures';
import { useFuturesChartLines } from '../../features/futures-trading/hooks/use-futures-chart-lines';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useMarketTickers } from '../../features/market/hooks/use-market-tickers';
import {
  useMarketTrades,
  useOrderBook,
} from '../../features/market/hooks/use-order-book';
import { DemoTradingBanner } from '../../features/paper-trading/components/DemoTradingBanner';
import { MarketTradesPanel } from '../../features/paper-trading/components/MarketTradesPanel';
import { OrderBookPanel } from '../../features/paper-trading/components/OrderBookPanel';
import {
  PairSelector,
  type FavoritePairs,
} from '../../features/paper-trading/components/PairSelector';
import { PaperNav } from '../../features/paper-trading/components/PaperNav';
import type { PickedPrice } from '../../features/paper-trading/components/SpotOrderForm';
import { TradePanel } from '../../features/paper-trading/components/TradePanel';
import { usePaperAccount } from '../../features/paper-trading/hooks/use-paper-account';
import { usePaperPush } from '../../features/paper-trading/hooks/use-paper-orders';
import { useTradeTimeframe } from '../../features/paper-trading/hooks/use-trade-timeframe';
import { useWatchlist } from '../../features/watchlist/hooks/use-watchlist';
import type { Decimal, MarketPair } from '../../types/domain';
import type { FuturesAccountEvent } from '../../types/futures';
import { classNames } from '../../utils/class-names';

type PhoneRegion = 'chart' | 'book' | 'trades';
const LAST_PAIR_KEY = 'cryptopilot.trade.futures.lastPair';

function readLastPair(): string | null {
  try {
    return localStorage.getItem(LAST_PAIR_KEY);
  } catch {
    return null;
  }
}

function rememberPair(symbol: string) {
  try {
    localStorage.setItem(LAST_PAIR_KEY, symbol);
  } catch {
    // A private window keeps no last pair; the first one opens instead.
  }
}

/** The trading workspace of one enabled Futures pair. */
function TradeFutures({
  pair,
  pairs,
}: {
  pair: MarketPair;
  pairs: readonly MarketPair[];
}) {
  const copy = useCopy();
  const p = copy.paper;
  const f = copy.futures;
  const toast = useToast();
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useTradeTimeframe();
  const [region, setRegion] = useState<PhoneRegion>('chart');
  const [picked, setPicked] = useState<PickedPrice | null>(null);
  const pick = (price: Decimal) => setPicked({ price, at: Date.now() });
  rememberPair(pair.symbol);

  const account = usePaperAccount();
  usePaperPush();
  const onMarginCall = useCallback(
    (event: Extract<FuturesAccountEvent, { kind: 'marginCall' }>) =>
      toast.show({
        tone: 'error',
        message: formatCopy(f.marginCallToast, {
          subject: event.call.symbol ?? f.crossPositions,
          ratio: (Number(event.call.marginRatio) * 100).toFixed(2),
        }),
      }),
    [toast, f],
  );
  useFuturesPush(onMarginCall);
  const futuresAccount = useFuturesAccount();
  const positions = useFuturesPositions(null);
  const config = useFuturesSymbolConfig(pair.symbol);
  const mode = useFuturesPositionMode();
  const brackets = useFuturesBrackets(pair.symbol);
  const chart = useFuturesChartLines(pair, positions.data);

  const { ticker, freshness } = useLiveTicker('futures', pair.symbol);
  const book = useOrderBook('futures', pair.symbol);
  const trades = useMarketTrades('futures', pair.symbol);
  const symbols = useMemo(() => pairs.map((each) => each.symbol), [pairs]);
  const board = useMarketTickers('futures', symbols);
  const ticks = useMemo(
    () => new Map(pairs.map((each) => [each.symbol, each.tickSize] as const)),
    [pairs],
  );
  const watchlist = useWatchlist();
  const favorites: FavoritePairs = watchlist.isPending
    ? { status: 'loading' }
    : watchlist.isError
      ? { status: 'error', message: errorText(copy, watchlist.error) }
      : {
          status: 'ready',
          symbols: new Set(
            watchlist.data.items
              .filter((item) => item.futuresListed)
              .map((item) => item.symbol),
          ),
        };
  const shown = (name: PhoneRegion) =>
    region === name ? 'flex' : 'hidden md:flex';
  const unavailable = account.isError ? errorText(copy, account.error) : null;

  return (
    <>
      <FuturesTickerStrip
        pair={pair}
        ticker={ticker}
        freshness={freshness}
        selector={
          <PairSelector
            pairs={pairs}
            tickers={board.tickers}
            favorites={favorites}
            current={pair}
            onSelect={(symbol) => void navigate('/trade/futures/' + symbol)}
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
            market="futures"
            symbol={pair.symbol}
            tickSize={pair.tickSize}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            priceLines={chart.lines}
            extendable
            height="h-[420px] xl:h-[480px]"
          />
        </div>
        <div
          className={classNames(
            shown('book'),
            'relative h-[560px] flex-col xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:h-auto',
          )}
        >
          <OrderBookPanel
            pair={pair}
            stream={book}
            lastPrice={ticker?.lastPrice ?? null}
            onPickPrice={pick}
            className="absolute inset-0"
          />
        </div>
        <div
          className={classNames(
            shown('trades'),
            'relative h-[560px] flex-col xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:h-auto',
          )}
        >
          <MarketTradesPanel
            pair={pair}
            stream={trades}
            onPickPrice={pick}
            className="absolute inset-0"
          />
        </div>
        <TradePanel
          title={p.orderForm}
          className="md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-2"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <FuturesSettingsBar
                symbol={pair.symbol}
                config={config.data}
                brackets={brackets.data}
                dualSide={mode.data}
              />
              <FuturesOrderForm
                key={pair.symbol}
                pair={pair}
                lastPrice={ticker?.lastPrice ?? null}
                markPrice={ticker?.markPrice ?? null}
                picked={picked}
                config={config.data}
                account={futuresAccount.data}
                positions={positions.data}
                brackets={brackets.data}
                hedge={mode.data === true}
                unavailable={unavailable}
              />
            </div>
            <AccountMarginPanel account={futuresAccount.data} />
          </div>
        </TradePanel>
      </div>
      <FuturesBottomPanel
        pair={pair}
        positions={positions.data}
        ticks={ticks}
      />
    </>
  );
}

/** Without the Futures feature the screen shows MSG29 (Q-T10). */
function FuturesLocked() {
  const copy = useCopy();
  return (
    <section
      aria-labelledby="futures-trade-locked"
      className="mx-auto mt-6 max-w-md rounded-xl border border-line bg-surface p-6 text-center"
    >
      <Lock size={20} aria-hidden="true" className="mx-auto mb-3 text-muted" />
      <h1
        id="futures-trade-locked"
        className="mb-2 text-base font-semibold text-fg"
      >
        {copy.futures.lockedTitle}
      </h1>
      <p className="mb-4 text-sm text-muted">
        {messageText(copy, 'MSG29', [], { plan: 'PRO' })}
      </p>
      <Link
        to="/subscription"
        className={buttonClassName('primary', 'md', 'no-underline')}
      >
        {copy.analysis.viewPlans}
      </Link>
    </section>
  );
}

/**
 * Paper Futures USDⓈ-M trading (D-86, D-127, TR-F4a … f): the layout of an
 * exchange's Futures screen with the pair switcher, the instrument strip
 * with mark and funding, the chart with the positions' entry and
 * liquidation lines, the order book and trades, the order form with the
 * margin settings and the account, and the positions and orders below.
 * Without a symbol the pair last opened here reopens, or else the first.
 */
export function TradeFuturesPage() {
  const copy = useCopy();
  const access = useFeature('FUTURES_ANALYSIS');
  const { symbol = '' } = useParams();
  const pairs = useMarketPairs('futures');
  const pair = pairs.data?.find(
    (candidate) => candidate.symbol === symbol.toUpperCase(),
  );
  const first = pairs.data?.[0];

  if (access !== 'locked' && symbol === '' && first) {
    const last = readLastPair();
    const reopen =
      pairs.data?.find((candidate) => candidate.symbol === last) ?? first;
    return <Navigate replace to={'/trade/futures/' + reopen.symbol} />;
  }
  return (
    <div className="w-full">
      <DemoTradingBanner />
      <PaperNav />
      {access === 'locked' ? (
        <FuturesLocked />
      ) : pairs.isPending ? (
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
          {copy.chart.pairUnavailableFutures}{' '}
          {first && (
            <Link to={'/trade/futures/' + first.symbol}>{first.symbol}</Link>
          )}
        </p>
      ) : (
        <TradeFutures key={pair.symbol} pair={pair} pairs={pairs.data} />
      )}
    </div>
  );
}
