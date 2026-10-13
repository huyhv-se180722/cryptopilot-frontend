import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { StatCard } from '../../components/layout/StatCard';
import { buttonClassName } from '../../components/ui/button-styles';
import { useCopy, useLocale } from '../../hooks/use-copy';
import { usePlanLimit, usePlanTier } from '../../hooks/use-entitlement';
import { formatCopy } from '../../i18n/copy';
import {
  DashboardCard,
  PendingBlock,
} from '../../features/dashboard/components/DashboardCard';
import { MarketSnapshot } from '../../features/dashboard/components/MarketSnapshot';
import { NewsBlock } from '../../features/dashboard/components/NewsBlock';
import { PlanSnapshot } from '../../features/dashboard/components/PlanSnapshot';
import { WatchlistSnapshot } from '../../features/dashboard/components/WatchlistSnapshot';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useMarketTickers } from '../../features/market/hooks/use-market-tickers';
import { usePlanCount } from '../../features/trading-plan/hooks/use-plans';
import { useWatchlist } from '../../features/watchlist/hooks/use-watchlist';

/** "3 / 5" with a plan limit, "3" without; `none` until the count is known. */
function counted(
  count: number | undefined,
  max: number | null | undefined,
  none: string,
) {
  if (count === undefined) return none;
  return typeof max === 'number' ? `${count} / ${max}` : String(count);
}

/**
 * SCR-08 Trader Dashboard (T-111), the Trader's home after sign-in, from
 * the Figma "Trading Overview" frame with the SRS content: watchlist
 * snapshot, active plans and open positions, recent notifications,
 * performance summary and latest news, plus a market snapshot. Only
 * values the backend provides are shown: blocks whose API is not merged
 * (notifications T-056, performance T-051, news T-079) say so. Plans,
 * watchlist, analysis and journal are one click away (SRS 4).
 */
export function DashboardPage() {
  const copy = useCopy();
  const locale = useLocale();
  // In the interface's language, as the rest of the header (A-43).
  const today = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    [locale],
  );
  const d = copy.dashboard;
  const none = copy.market.noValue;
  const pairs = useMarketPairs('spot');
  const symbols = useMemo(
    () => (pairs.data ?? []).map((pair) => pair.symbol),
    [pairs.data],
  );
  const board = useMarketTickers('spot', symbols);
  const tier = usePlanTier() ?? '';
  const activeMax = usePlanLimit('ACTIVE_PLAN_MAX');
  const watchMax = usePlanLimit('WATCHLIST_MAX');
  const active = usePlanCount('ACTIVE');
  const executed = usePlanCount('EXECUTED');
  const watchlist = useWatchlist();
  const watched = watchlist.data?.items.length;

  const limitNote = (
    count: number | undefined,
    max: number | null | undefined,
  ) =>
    max === undefined || count === undefined
      ? undefined
      : max === null
        ? formatCopy(d.kpiNoLimit, { plan: tier })
        : count >= max
          ? formatCopy(d.kpiLimitFull, { plan: tier })
          : formatCopy(d.kpiLimitLeft, { left: max - count, plan: tier });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-fg">{d.title}</h1>
          <p className="mt-0.5 text-xs text-muted-dim">
            {formatCopy(d.subtitle, {
              date: today.format(new Date()),
              plans:
                active.data === undefined
                  ? none
                  : typeof activeMax === 'number'
                    ? formatCopy(d.activePlansOf, {
                        count: active.data,
                        max: activeMax,
                      })
                    : formatCopy(d.activePlans, { count: active.data }),
            })}
          </p>
        </div>
        <Link
          to="/plans/new"
          className={buttonClassName('primary', 'md', 'no-underline')}
        >
          <Plus size={14} aria-hidden="true" />
          {copy.plan.newPlan}
        </Link>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={d.kpiActive}
          value={counted(active.data, activeMax, none)}
          status={limitNote(active.data, activeMax)}
          accent="warning"
        />
        <StatCard
          label={d.kpiExecuted}
          value={counted(executed.data, undefined, none)}
          status={d.kpiExecutedNote}
          accent="positive"
        />
        <StatCard
          label={d.kpiWatchlist}
          value={counted(watched, watchMax, none)}
          status={limitNote(watched, watchMax)}
          accent="primary"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {pairs.data && (
            <MarketSnapshot pairs={pairs.data} tickers={board.tickers} />
          )}
          <PlanSnapshot />
        </div>
        <WatchlistSnapshot pairs={pairs.data ?? []} tickers={board.tickers} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DashboardCard
          title={d.notificationsTitle}
          link={{ to: '/notifications', label: d.openPage }}
        >
          <PendingBlock message={copy.errors.notConfigured} />
        </DashboardCard>
        <DashboardCard
          title={d.performanceTitle}
          link={{ to: '/performance', label: d.openPage }}
        >
          <PendingBlock message={copy.errors.notConfigured} />
        </DashboardCard>
        <NewsBlock />
      </div>
    </div>
  );
}
