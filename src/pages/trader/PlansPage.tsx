import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Alert, ErrorState } from '../../components/feedback/States';
import { Button } from '../../components/ui/Button';
import { buttonClassName } from '../../components/ui/button-styles';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { useCopy } from '../../hooks/use-copy';
import { usePlanLimit, usePlanTier } from '../../hooks/use-entitlement';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import {
  useMarketPairs,
  usePairLookup,
} from '../../features/market/hooks/use-market-data';
import { PlanFilters } from '../../features/trading-plan/components/PlanFilters';
import { PlanTable } from '../../features/trading-plan/components/PlanTable';
import {
  PLAN_PERIODS,
  type PlanPeriod,
} from '../../features/trading-plan/components/plan-format';
import {
  PLAN_PAGE_SIZE,
  useActivePlanCount,
  usePlanList,
  usePositionUpdates,
} from '../../features/trading-plan/hooks/use-plans';
import type { MarketType, PlanTab } from '../../types/domain';

const TABS: readonly PlanTab[] = [
  'DRAFT',
  'ACTIVE',
  'EXECUTED',
  'CANCELLED_EXPIRED',
];

const tabOf = (value: string | null): PlanTab =>
  TABS.includes(value as PlanTab) ? (value as PlanTab) : 'DRAFT';
const marketOf = (value: string | null): MarketType | 'all' =>
  value === 'spot' || value === 'futures' ? value : 'all';
const periodOf = (value: string | null): PlanPeriod =>
  PLAN_PERIODS.includes(value as PlanPeriod) ? (value as PlanPeriod) : 'all';

/** `ACTIVE_PLAN_MAX` of the plan (BR-62); shown only when the plan has one. */
function ActiveLimit() {
  const copy = useCopy();
  const p = copy.plan;
  const max = usePlanLimit('ACTIVE_PLAN_MAX');
  const tier = usePlanTier();
  const count = useActivePlanCount(typeof max === 'number');
  if (typeof max !== 'number' || count.data === undefined) return null;
  return (
    <Alert
      tone={count.data >= max ? 'warning' : 'info'}
      title={formatCopy(p.limitBanner, {
        active: count.data,
        max,
        plan: tier ?? '',
      })}
      className="mb-4"
    >
      <Link to="/subscription" className="font-medium">
        {p.upgrade}
      </Link>
    </Alert>
  );
}

/**
 * SCR-16 Trading Plans (SRS 3.5.2, UC-20): status tabs, market and period
 * filters, 20 rows per page (CR-04); tab, filters and page live in the URL.
 * A row opens SCR-18. Pairs are named and filtered by the id the market
 * lists give (FEQ-01); position status and P/L wait for simulated
 * execution (M-10).
 */
export function PlansPage() {
  const copy = useCopy();
  const p = copy.plan;
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get('tab'));
  const pairId = params.get('pair') ?? '';
  const market = marketOf(params.get('market'));
  const pairOf = usePairLookup();
  const spotPairs = useMarketPairs('spot').data;
  const futuresPairs = useMarketPairs('futures').data;
  const pairs = useMemo(() => {
    const spot = spotPairs ?? [];
    const onSpot = new Set(spot.map((pair) => pair.pairId));
    return [
      ...spot,
      ...(futuresPairs ?? []).filter((pair) => !onSpot.has(pair.pairId)),
    ];
  }, [spotPairs, futuresPairs]);
  const period = periodOf(params.get('period'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  // A position closed by the engine updates the Executed tab (T-048b).
  usePositionUpdates();
  const list = usePlanList({
    tab,
    page,
    ...(pairId ? { pairId } : {}),
    ...(market === 'all' ? {} : { market }),
    ...(period === 'all' ? {} : { periodDays: Number(period) }),
  });
  const pages = Math.max(
    1,
    Math.ceil((list.data?.total ?? 0) / PLAN_PAGE_SIZE),
  );
  const filtered = pairId !== '' || market !== 'all' || period !== 'all';

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes))
      if (value === null) next.delete(key);
      else next.set(key, value);
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  }

  const panel = list.isPending ? (
    <Skeleton className="h-72 w-full" />
  ) : list.isError ? (
    <ErrorState
      message={errorText(copy, list.error)}
      onRetry={() => void list.refetch()}
    />
  ) : (
    <>
      <PlanTable
        tab={tab}
        rows={list.data.items}
        emptyMessage={filtered ? p.emptyFiltered : p.empty}
        pairOf={(row) => pairOf(row.pairId, row.market)}
      />
      {list.data.total > PLAN_PAGE_SIZE && (
        <nav
          aria-label={formatCopy(p.pageOf, { page, pages })}
          className="mt-3 flex items-center justify-end gap-3 text-xs text-muted"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) })}
          >
            {p.previous}
          </Button>
          <span aria-live="polite">
            {formatCopy(p.pageOf, { page, pages })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => update({ page: String(page + 1) })}
          >
            {p.next}
          </Button>
        </nav>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-fg">{p.listTitle}</h1>
        <Link
          to="/plans/new"
          className={buttonClassName('primary', 'md', 'no-underline')}
        >
          <Plus size={14} aria-hidden="true" />
          {p.newPlan}
        </Link>
      </header>
      <ActiveLimit />
      <PlanFilters
        pairs={pairs}
        pairId={pairId}
        market={market}
        period={period}
        onPairChange={(value) => update({ pair: value || null })}
        onMarketChange={(value) =>
          update({ market: value === 'all' ? null : value })
        }
        onPeriodChange={(value) =>
          update({ period: value === 'all' ? null : value })
        }
        onReset={() => update({ pair: null, market: null, period: null })}
      />
      <Tabs
        label={p.tabsLabel}
        value={tab}
        onChange={(id) => update({ tab: id })}
        items={TABS.map((id) => ({
          id,
          label: p[`tab${id}`],
          panel: id === tab ? panel : null,
        }))}
      />
    </div>
  );
}
