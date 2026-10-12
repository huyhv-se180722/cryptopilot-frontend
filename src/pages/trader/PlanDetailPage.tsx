import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
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
import { usePlan } from '../../features/trading-plan/hooks/use-plans';

/**
 * SCR-18 Trading Plan Detail (SRS 3.5.3, UC-18, UC-19): inputs,
 * calculation snapshot, warnings, status history and the actions. The
 * live position of an executed plan waits for simulated execution; the
 * chart with the plan's lines waits for the pair symbol (FEQ-01). The
 * MSG42 disclaimer is in the shell footer.
 */
export function PlanDetailPage() {
  const copy = useCopy();
  const p = copy.plan;
  const { planId = '' } = useParams();
  const query = usePlan(planId);
  const plan = query.data;
  const missing = query.missing;

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
              {formatCopy(p.detailTitle, { id: shortPlanId(plan.id) })}
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
              <PlanInputsPanel plan={plan} />
              <PlanSnapshotPanel plan={plan} />
              {plan.status === 'EXECUTED' && <PlanPositionPanel />}
            </div>
            <div className="flex flex-col gap-4">
              <PlanWarningsPanel plan={plan} />
              <PlanHistoryPanel plan={plan} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
