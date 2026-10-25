import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useProfileData } from '../../features/profile/hooks/use-profile';
import { PlanEditor } from '../../features/trading-plan/components/PlanEditor';
import { timeframeOfStyle } from '../../features/trading-plan/components/plan-form';
import { PlanChart } from './plan-chart';
import { PlanFuturesStrip } from './plan-futures-strip';

/**
 * SCR-17 New Trading Plan (SRS 3.5.1, UC-16): the plan form on a pair of
 * the market lists, by its id (FEQ-01), Spot or Futures; `?symbol=` and
 * `?market=futures` start on a pair, as the analysis screens' Create
 * trading plan does. Without the Futures list a plan is Spot only. The
 * analysis timeframe starts on the one of the Trader's trading style
 * (D-112); when the profile cannot be read the server chooses it.
 */
export function PlanCreatePage() {
  const copy = useCopy();
  const p = copy.plan;
  const [params] = useSearchParams();
  const symbol = params.get('symbol')?.toUpperCase() ?? null;
  const market = params.get('market') === 'futures' ? 'futures' : 'spot';
  const pairs = useMarketPairs('spot');
  const futuresPairs = useMarketPairs('futures');
  const futures = futuresPairs.data ?? [];
  const start = (market === 'futures' ? futures : (pairs.data ?? [])).find(
    (pair) => pair.symbol === symbol,
  );
  const profile = useProfileData().state;

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
      {pairs.isPending ||
      futuresPairs.isPending ||
      profile.status === 'loading' ? (
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
          key={`${market}.${start?.pairId ?? 'new'}`}
          target={{
            mode: 'create',
            pairs: { spot: pairs.data, futures },
            market,
            pairId: start?.pairId ?? null,
            timeframe:
              profile.status === 'success'
                ? timeframeOfStyle(profile.data.profile.tradingStyle)
                : null,
          }}
          chart={(pair, lines) => <PlanChart pair={pair} lines={lines} />}
          futuresContext={(pair) => <PlanFuturesStrip pair={pair} />}
        />
      )}
    </div>
  );
}
