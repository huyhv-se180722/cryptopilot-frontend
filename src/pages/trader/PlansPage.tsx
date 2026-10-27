import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Alert, ErrorState } from '../../components/feedback/States';
import { Button } from '../../components/ui/Button';
import { buttonClassName } from '../../components/ui/button-styles';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { useCopy } from '../../hooks/use-copy';
import { usePlanLimit, usePlanTier } from '../../hooks/use-entitlement';
import { useServices } from '../../hooks/use-services';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import {
  useMarketPairs,
  usePairLookup,
} from '../../features/market/hooks/use-market-data';
import { CoinPricesProvider } from '../../features/community/components/CoinPricesProvider';
import { TokenRail } from '../../features/community/components/TokenRail';
import { useCoinPrices } from '../../features/community/components/coin-prices';
import { JournalPanel } from '../../features/journal/components/JournalPanel';
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
import type { MarketPair, MarketType, PlanTab } from '../../types/domain';
import { classNames } from '../../utils/class-names';

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

const RAIL_KEY = 'cp.plans.coins-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * How many plans each tab holds under the page's filters, so a plan that
 * moved on (a fill takes it from Active to Executed) is seen to be there.
 * The key sits under the plan list's, which every change of a plan
 * invalidates.
 */
function useTabCounts(filter: {
  pairId?: string;
  market?: MarketType;
  periodDays?: number;
}) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: ['plans', 'list', 'tab-counts', filter],
    queryFn: async ({ signal }) => {
      const from = filter.periodDays
        ? new Date(Date.now() - filter.periodDays * 86_400_000).toISOString()
        : undefined;
      const totals = await Promise.all(
        TABS.map((tab) =>
          tradingPlan
            .list(
              {
                tab,
                page: 1,
                pageSize: 1,
                ...(filter.pairId ? { pairId: filter.pairId } : {}),
                ...(filter.market ? { market: filter.market } : {}),
                ...(from ? { from } : {}),
              },
              signal,
            )
            .then((page) => page.total),
        ),
      );
      return new Map(TABS.map((tab, index) => [tab, totals[index] ?? 0]));
    },
  });
}

/**
 * The coin column (the community's coin list, D-99): live Spot prices;
 * choosing a coin filters the plans and the journal by its pair, choosing
 * it again clears the filter.
 */
function CoinColumn({
  pairId,
  onPair,
}: {
  pairId: string;
  onPair: (pairId: string) => void;
}) {
  const p = useCopy().plan;
  const { quotes } = useCoinPrices();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const selected =
    [...quotes.values()].find((quote) => quote.pair.pairId === pairId)?.coin ??
    '';
  const collapse = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(RAIL_KEY, next ? '1' : '0');
    } catch {
      // A blocked storage only forgets the choice.
    }
  };
  return (
    <TokenRail
      selected={selected}
      onSelect={(coin) =>
        onPair(coin ? (quotes.get(coin)?.pair.pairId ?? '') : '')
      }
      trader
      collapsed={collapsed}
      onCollapse={collapse}
      title={p.coinsTitle}
      label={p.coinsLabel}
      side="right"
    />
  );
}

/** The New plan link, on the chosen pair when the page is filtered by one. */
function newPlanPath(pair: MarketPair | undefined, market: MarketType | 'all') {
  if (!pair) return '/plans/new';
  const params = new URLSearchParams({ symbol: pair.symbol });
  if (market === 'futures') params.set('market', 'futures');
  return '/plans/new?' + params.toString();
}

/**
 * SCR-16 Trading Plans (SRS 3.5.2, UC-20): status tabs, market and period
 * filters, 20 rows per page (CR-04); tab, filters and page live in the URL.
 * A row opens SCR-18. Pairs are named and filtered by the id the market
 * lists give (FEQ-01); the Executed tab shows each position's status
 * (T-048a). The journal (SCR-20) is the left column and the coin list the
 * right one; the pair filter is shared by all three.
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
  const counts = useTabCounts({
    ...(pairId ? { pairId } : {}),
    ...(market === 'all' ? {} : { market }),
    ...(period === 'all' ? {} : { periodDays: Number(period) }),
  });
  const chosenPair = pairId
    ? pairOf(pairId, market === 'futures' ? 'futures' : 'spot')
    : undefined;

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes))
            if (value === null) next.delete(key);
            else next.set(key, value);
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

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
    <CoinPricesProvider>
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-lg font-semibold text-fg">
            {p.listTitle}
          </h1>
          <Link
            to={newPlanPath(chosenPair, market)}
            className={buttonClassName('primary', 'md', 'no-underline')}
          >
            <Plus size={14} aria-hidden="true" />
            {chosenPair
              ? formatCopy(p.newPlanFor, {
                  coin: chosenPair.baseAsset ?? chosenPair.symbol,
                })
              : p.newPlan}
          </Link>
        </header>
        <div
          className={classNames(
            'grid gap-5',
            'xl:grid-cols-[280px_minmax(0,1fr)_auto]',
          )}
        >
          <div className="min-w-0 xl:order-2">
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
              items={TABS.map((id) => {
                const count = counts.data?.get(id);
                return {
                  id,
                  label:
                    p[`tab${id}`] + (count === undefined ? '' : ` (${count})`),
                  panel: id === tab ? panel : null,
                };
              })}
            />
          </div>
          <aside className="min-w-0 xl:order-1">
            <JournalPanel
              key={pairId}
              pairId={pairId}
              pairOf={pairOf}
              className="xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)]"
            />
          </aside>
          <aside className="hidden xl:order-3 xl:block">
            <div className="xl:w-[250px] has-[>button]:xl:w-9">
              <CoinColumn
                pairId={pairId}
                onPair={(value) => update({ pair: value || null })}
              />
            </div>
          </aside>
        </div>
      </div>
    </CoinPricesProvider>
  );
}
