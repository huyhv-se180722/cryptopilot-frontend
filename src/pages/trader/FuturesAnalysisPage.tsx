import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Lock } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { buttonClassName } from '../../components/ui/button-styles';
import { NumericText } from '../../components/ui/NumericText';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { useFeature } from '../../hooks/use-entitlement';
import { errorText, messageText } from '../../i18n/messages';
import {
  AlertDialog,
  type AlertDialogTarget,
} from '../../features/alerts/components/AlertDialog';
import { AnalysisActions } from '../../features/analysis/components/AnalysisActions';
import { FuturesMetricsPanel } from '../../features/analysis/components/FuturesMetricsPanel';
import { FuturesPricePanel } from '../../features/analysis/components/FuturesPricePanel';
import { KeyLevels } from '../../features/analysis/components/KeyLevels';
import { PairNews } from '../../features/analysis/components/PairNews';
import { SetupScoreCard } from '../../features/analysis/components/SetupScoreCard';
import { CoinDiscussionCard } from '../../features/community/components/CoinDiscussionCard';
import { useLeaveDisabledPair } from '../../features/analysis/hooks/use-leave-disabled-pair';
import { useLiveTicker } from '../../features/analysis/hooks/use-live-ticker';
import { usePairAnalysis } from '../../features/analysis/hooks/use-pair-analysis';
import { AnalysisChart } from '../../features/chart/components/AnalysisChart';
import { FreshnessBadge } from '../../features/market/components/FreshnessBadge';
import {
  useListedPair,
  useMarketPairs,
} from '../../features/market/hooks/use-market-data';
import {
  useAddToWatchlist,
  useWatchedPair,
} from '../../features/watchlist/hooks/use-watchlist';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { pairLabel } from '../../utils/pair-label';
import type { CandleTimeframe, MarketPair } from '../../types/domain';
import { formatPrice, fractionToPercent } from '../../utils/decimal-format';

/** The analysis of an enabled Futures pair (rendered once the pair is known). */
function FuturesAnalysis({ pair }: { pair: MarketPair }) {
  const watched = useWatchedPair(pair.symbol);
  const listed = useListedPair(pair);
  const add = useAddToWatchlist();
  const toast = useToast();
  const [alertTarget, setAlertTarget] = useState<AlertDialogTarget | null>(
    null,
  );
  const copy = useCopy();
  const a = copy.analysis;
  const [timeframe, setTimeframe] = useState<CandleTimeframe>('1h');
  const analysis = usePairAnalysis('futures', pair.symbol, timeframe);
  const { ticker, freshness } = useLiveTicker('futures', pair.symbol);
  useLeaveDisabledPair(analysis.error);
  const data = analysis.data;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <h1 className="text-lg font-semibold text-fg">
          {pair.baseAsset ?? pair.symbol}
          <span className="font-normal text-muted-dim">
            /{pair.quoteAsset ?? ''}
          </span>
          <span className="ml-2 rounded border border-line px-1.5 align-middle text-[10px] font-semibold tracking-wider text-muted uppercase">
            {copy.market.perpetual}
          </span>
        </h1>
        {/* M-09: Futures has no last price; the mark price leads. */}
        {ticker?.markPrice && (
          <span className="flex items-baseline gap-2">
            <span className="text-[10px] tracking-wider text-muted-x uppercase">
              {a.statMark}
            </span>
            <NumericText
              className="text-lg font-semibold text-fg"
              value={formatPrice(ticker.markPrice, pair.tickSize)}
            />
            {ticker.fundingRate && (
              <span className="text-xs text-muted-dim">
                {a.statFunding}{' '}
                <NumericText
                  signed
                  value={fractionToPercent(ticker.fundingRate, 4)}
                  suffix="%"
                />
              </span>
            )}
          </span>
        )}
        <span className="ml-auto">
          <FreshnessBadge freshness={freshness} />
        </span>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <AnalysisChart
            market="futures"
            symbol={pair.symbol}
            tickSize={pair.tickSize}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            {...(data
              ? {
                  levels: {
                    support: data.nearestSupport,
                    resistance: data.nearestResistance,
                  },
                }
              : {})}
          />
          <FuturesMetricsPanel
            symbol={pair.symbol}
            baseAsset={pair.baseAsset ?? pair.symbol}
          />
          <PairNews coin={pair.baseAsset ?? pair.symbol} />
        </div>
        <div className="flex flex-col gap-4">
          {analysis.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : analysis.isError ? (
            <ErrorState
              message={errorText(copy, analysis.error)}
              onRetry={() => void analysis.refetch()}
            />
          ) : (
            <SetupScoreCard setup={analysis.data.setupScore} />
          )}
          <FuturesPricePanel ticker={ticker} tickSize={pair.tickSize} />
          <KeyLevels
            support={data?.nearestSupport ?? null}
            resistance={data?.nearestResistance ?? null}
            tickSize={pair.tickSize}
          />
          <AnalysisActions
            market="futures"
            symbol={pair.symbol}
            planHref={`/plans/new?symbol=${encodeURIComponent(pair.symbol)}&market=futures`}
            watched={watched === undefined ? undefined : watched !== null}
            adding={add.pending}
            onAddWatchlist={() =>
              void add.run(pair.pairId).then((result) => {
                if (result.status === 'success')
                  toast.show({
                    tone: 'success',
                    message: formatCopy(copy.analysis.addedWatchlist, {
                      pair: pairLabel(pair.symbol),
                    }),
                  });
                else if (result.status === 'error')
                  toast.show({
                    tone: 'error',
                    message: errorText(copy, result.error),
                  });
              })
            }
            onCreateAlert={
              listed
                ? () =>
                    setAlertTarget({
                      mode: 'create',
                      pairs: [watched ?? listed],
                      pairId: pair.pairId,
                      addsToWatchlist: watched === null,
                      market: 'futures',
                    })
                : undefined
            }
          />
          <CoinDiscussionCard coin={pair.baseAsset ?? pair.symbol} links />
          <AlertDialog
            target={alertTarget}
            onClose={() => setAlertTarget(null)}
          />
        </div>
      </div>
    </>
  );
}

/** FREE: the Futures tab lists prices, the analysis shows MSG29 (SRS 3.3.3). */
function FuturesLocked() {
  const copy = useCopy();
  const a = copy.analysis;
  return (
    <section
      aria-labelledby="futures-locked-title"
      className="mx-auto mt-6 max-w-md rounded-xl border border-line bg-surface p-6 text-center"
    >
      <Lock size={20} aria-hidden="true" className="mx-auto mb-3 text-muted" />
      <h1
        id="futures-locked-title"
        className="mb-2 text-base font-semibold text-fg"
      >
        {a.futuresLockedTitle}
      </h1>
      <p className="mb-4 text-sm text-muted">
        {messageText(copy, 'MSG29', [], { plan: 'PRO' })}
      </p>
      <Link
        to="/subscription"
        className={buttonClassName('primary', 'md', 'no-underline')}
      >
        {a.viewPlans}
      </Link>
    </section>
  );
}

/**
 * SCR-11 Futures Pair Analysis (SRS 3.3.3, UC-11): everything of SCR-10 on
 * Futures candles, plus mark and index price, funding with the countdown
 * to the next funding time, open interest and long/short ratio charts,
 * and the derivatives component with the dominant side on the score
 * card. PRO and PREMIUM only: FREE sees MSG29 (display only, the backend
 * decides every request).
 */
export function FuturesAnalysisPage() {
  const copy = useCopy();
  const access = useFeature('FUTURES_ANALYSIS');
  const { symbol = '' } = useParams();
  const pairs = useMarketPairs('futures');
  const pair = pairs.data?.find(
    (candidate) => candidate.symbol === symbol.toUpperCase(),
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        to="/markets?market=futures"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted no-underline hover:text-fg-2"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        {copy.chart.backToMarkets}
      </Link>
      {access === 'locked' ? (
        <FuturesLocked />
      ) : pairs.isPending ? (
        <Skeleton className="h-[430px] w-full" />
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
          {copy.chart.pairUnavailableFutures}
        </p>
      ) : (
        <FuturesAnalysis key={pair.symbol} pair={pair} />
      )}
    </div>
  );
}
