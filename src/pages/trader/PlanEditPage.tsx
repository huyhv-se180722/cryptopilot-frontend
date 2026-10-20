import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import { PlanStatusBadge } from '../../features/trading-plan/components/PlanBadges';
import { PlanEditor } from '../../features/trading-plan/components/PlanEditor';
import { shortPlanId } from '../../features/trading-plan/components/plan-format';
import { usePairLookup } from '../../features/market/hooks/use-market-data';
import { usePlan } from '../../features/trading-plan/hooks/use-plans';

/**
 * SCR-17 Edit Trading Plan (SRS 3.5.1, UC-17) for a DRAFT; any other status
 * is read-only (BR-32) and links back to SCR-18. The pair is named from
 * the market lists by its id (FEQ-01). Creating a plan, and the chart whose
 * lines follow the inputs, come with the new plan form (T-040).
 */
export function PlanEditPage() {
  const copy = useCopy();
  const p = copy.plan;
  const { planId = '' } = useParams();
  const query = usePlan(planId);
  const plan = query.data;
  const id = shortPlanId(planId);
  const pairOf = usePairLookup();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        to={`/plans/${planId}`}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted no-underline hover:text-fg-2"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        {formatCopy(p.backToPlan, { id })}
      </Link>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-fg">
          {formatCopy(p.editTitle, { id })}
        </h1>
        {plan && <PlanStatusBadge status={plan.status} />}
      </header>
      {query.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : query.missing ? (
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
      ) : plan.status !== 'DRAFT' ? (
        <p
          role="status"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-muted"
        >
          {formatCopy(p.notEditable, {
            status: p[`status${plan.status}`].toLowerCase(),
          })}{' '}
          <Link to={`/plans/${plan.id}`}>
            {formatCopy(p.backToPlan, { id })}
          </Link>
        </p>
      ) : (
        <PlanEditor
          key={plan.id}
          plan={plan}
          pair={pairOf(plan.pairId, plan.market)}
        />
      )}
    </div>
  );
}
