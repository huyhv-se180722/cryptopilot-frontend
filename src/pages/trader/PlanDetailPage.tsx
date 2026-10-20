import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import { AnalysisChart } from '../../features/chart/components/AnalysisChart';
import { usePairLookup } from '../../features/market/hooks/use-market-data';
import { PlanActions } from '../../features/trading-plan/components/PlanActions';
import {
  DirectionText,
  PlanStatusBadge,
} from '../../features/trading-plan/components/PlanBadges';
import {
  PlanHistoryPanel,
  PlanInputsPanel,
  PlanPositionPanel,
  PlanSnapshotPanel,
  PlanWarningsPanel,
} from '../../features/trading-plan/components/PlanDetailPanels';
import { shortPlanId } from '../../features/trading-plan/components/plan-format';
import { planLines } from '../../features/trading-plan/components/plan-lines';
import { usePlan } from '../../features/trading-plan/hooks/use-plans';
import type { CandleTimeframe } from '../../types/domain';
import { pairLabel } from '../../utils/pair-label';

/**
 * SCR-18 Trading Plan Detail (SRS 3.5.3, UC-18, UC-19): the pair, named
 * from the market lists by the plan's pair id (FEQ-01), the chart of that
 * market with the plan's entry, stop loss, take profit and estimated
 * liquidation, the inputs, calculation snapshot, warnings, status history
 * and the actions. The live position of an executed plan waits for
 * simulated execution. The MSG42 disclaimer is in the shell footer.
 */
export function PlanDetailPage() {
  const copy = useCopy();
  const p = copy.plan;
  const { planId = '' } = useParams();
  const query = usePlan(planId);
  const plan = query.data;
  const missing = query.missing;
  const pairOf = usePairLookup();
  const pair = plan ? pairOf(plan.pairId, plan.market) : undefined;
  // The chart reads the candles of the plan's own market.
  const charted = pair && plan && pair.market === plan.market ? pair : null;
  const [timeframe, setTimeframe] = useState<CandleTimeframe>('1h');

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        to="/plans"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted no-underline hover:text-fg-2"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        {p.backToList}
      </Link>
      {query.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : missing ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-muted"
        >
          {p.notFound}
        </p>
      ) : query.isError || !plan ? (
        <ErrorState
          message={errorText(copy, query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-lg font-semibold text-fg">
              {pair && `${pairLabel(pair.symbol)} `}
              <span className={pair ? 'font-normal text-muted' : undefined}>
                {formatCopy(p.detailTitle, { id: shortPlanId(plan.id) })}
              </span>
            </h1>
            <span className="rounded border border-line px-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
              {plan.market === 'futures'
                ? `${copy.market.futures}${plan.leverage ? ` · ${plan.leverage}x` : ''}`
                : copy.market.spot}
            </span>
            <DirectionText direction={plan.direction} />
            <PlanStatusBadge status={plan.status} />
          </header>
          <div className="mb-4">
            <PlanActions plan={plan} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4">
              {charted ? (
                <AnalysisChart
                  market={plan.market}
                  symbol={charted.symbol}
                  tickSize={charted.tickSize}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  priceLines={planLines(plan, {
                    entry: p.colEntry,
                    stopLoss: p.colStopLoss,
                    takeProfit: p.colTakeProfit,
                    liquidation: p.lineLiquidation,
                  })}
                />
              ) : pair ? (
                <p className="rounded-xl border border-line bg-surface p-4 text-xs text-muted">
                  {p.chartUnlisted}
                </p>
              ) : null}
              <PlanInputsPanel plan={plan} />
              <PlanSnapshotPanel plan={plan} />
              {plan.status === 'EXECUTED' && <PlanPositionPanel />}
            </div>
            <div className="flex flex-col gap-4">
              <PlanWarningsPanel
                warnings={plan.warnings}
                blocked={plan.blocksActivation && plan.status === 'DRAFT'}
              />
              <PlanHistoryPanel plan={plan} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
