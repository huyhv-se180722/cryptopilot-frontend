import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { AnalysisChart } from '../../features/chart/components/AnalysisChart';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';

/**
 * SCR-10 Spot Pair Analysis (SRS 3.3.2): the pair header and the analysis
 * chart. The setup score card, statistics, levels and actions are T-033.
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
        <>
          <h1 className="mb-4 text-lg font-semibold text-fg">
            {pair.baseAsset ?? pair.symbol}
            <span className="font-normal text-muted-dim">
              /{pair.quoteAsset ?? ''}
            </span>
            <span className="ml-2 rounded border border-line px-1.5 align-middle text-[10px] font-semibold tracking-wider text-muted uppercase">
              {copy.market.spot}
            </span>
          </h1>
          <AnalysisChart
            market="spot"
            symbol={pair.symbol}
            tickSize={pair.tickSize}
          />
        </>
      )}
    </div>
  );
}
