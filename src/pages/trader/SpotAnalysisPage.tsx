import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { NumericText } from '../../components/ui/NumericText';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import {
  AlertDialog,
  type AlertDialogTarget,
} from '../../features/alerts/components/AlertDialog';
import { AnalysisActions } from '../../features/analysis/components/AnalysisActions';
import { KeyLevels } from '../../features/analysis/components/KeyLevels';
import { MarketStatsPanel } from '../../features/analysis/components/MarketStatsPanel';
import { PairNews } from '../../features/analysis/components/PairNews';
import { SetupScoreCard } from '../../features/analysis/components/SetupScoreCard';
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
import { formatPrice, toFixedDecimal } from '../../utils/decimal-format';

/** The analysis of an enabled Spot pair (rendered once the pair is known). */
function SpotAnalysis({ pair }: { pair: MarketPair }) {
  const watched = useWatchedPair(pair.symbol);
  const listed = useListedPair(pair);
  const add = useAddToWatchlist();
  const toast = useToast();
  const [alertTarget, setAlertTarget] = useState<AlertDialogTarget | null>(
    null,
  );
  const copy = useCopy();
  const [timeframe, setTimeframe] = useState<CandleTimeframe>('1h');
  const analysis = usePairAnalysis('spot', pair.symbol, timeframe);
  const { ticker, freshness } = useLiveTicker('spot', pair.symbol);
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
            {copy.market.spot}
          </span>
        </h1>
        {ticker?.lastPrice && (
          <span className="flex items-baseline gap-2">
            <NumericText
              className="text-lg font-semibold text-fg"
              value={formatPrice(ticker.lastPrice, pair.tickSize)}
            />
            {ticker.changePercent24h && (
              <NumericText
                signed
                className="text-xs"
                value={toFixedDecimal(ticker.changePercent24h, 2)}
                suffix="%"
              />
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
            market="spot"
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
          <MarketStatsPanel ticker={ticker} tickSize={pair.tickSize} />
          <KeyLevels
            support={data?.nearestSupport ?? null}
            resistance={data?.nearestResistance ?? null}
            tickSize={pair.tickSize}
          />
          <AnalysisActions
            market="spot"
            symbol={pair.symbol}
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
                      market: 'spot',
                    })
                : undefined
            }
          />
          <AlertDialog
            target={alertTarget}
            onClose={() => setAlertTarget(null)}
          />
        </div>
      </div>
    </>
  );
}

/**
 * SCR-10 Spot Pair Analysis (SRS 3.3.2, UC-10): live price, the analysis
 * chart with BR-14 levels, the setup score card (preset, version,
 * disclaimer), market statistics, key levels, actions and the coin's news.
 */
export function SpotAnalysisPage() {
  const copy = useCopy();
  const { symbol = '' } = useParams();
  const pairs = useMarketPairs('spot');
  const pair = pairs.data?.find(
    (candidate) => candidate.symbol === symbol.toUpperCase(),
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        to="/markets"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted no-underline hover:text-fg-2"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        {copy.chart.backToMarkets}
      </Link>
      {pairs.isPending ? (
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
          {copy.chart.pairUnavailable}
        </p>
      ) : (
        <SpotAnalysis key={pair.symbol} pair={pair} />
      )}
    </div>
  );
}
