import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { PlanEditor } from '../../features/trading-plan/components/PlanEditor';
import { PlanChart } from './plan-chart';

/**
 * SCR-17 New Trading Plan (SRS 3.5.1, UC-16): the plan form on a Spot pair
 * of the market list, by its id (FEQ-01); `?symbol=` starts on a pair, as
 * the analysis screen's Create trading plan does. Futures plans wait for
 * the leverage brackets, so a new plan is Spot for now.
 */
export function PlanCreatePage() {
  const copy = useCopy();
  const p = copy.plan;
  const [params] = useSearchParams();
  const symbol = params.get('symbol')?.toUpperCase() ?? null;
  const pairs = useMarketPairs('spot');
  const start = pairs.data?.find((pair) => pair.symbol === symbol);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        to="/plans"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted no-underline hover:text-fg-2"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        {p.backToList}
      </Link>
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-fg">{p.createTitle}</h1>
      </header>
      {pairs.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : pairs.isError ? (
        <ErrorState
          message={errorText(copy, pairs.error)}
          onRetry={() => void pairs.refetch()}
        />
      ) : pairs.data.length === 0 ? (
        <p
          role="status"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-muted"
        >
          {p.createNoPairs}
        </p>
      ) : (
        <PlanEditor
          key={start?.pairId ?? 'new'}
          target={{
            mode: 'create',
            pairs: pairs.data,
            pairId: start?.pairId ?? null,
          }}
          chart={(pair, lines) => <PlanChart pair={pair} lines={lines} />}
        />
      )}
    </div>
  );
}
