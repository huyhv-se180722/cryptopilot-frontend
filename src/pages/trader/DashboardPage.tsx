import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { buttonClassName } from '../../components/ui/button-styles';
import { useCopy, useLocale } from '../../hooks/use-copy';
import { usePlanLimit, usePlanTier } from '../../hooks/use-entitlement';
import { formatCopy } from '../../i18n/copy';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { DashboardKpis } from '../../features/dashboard/components/DashboardKpis';
import { MarketSnapshot } from '../../features/dashboard/components/MarketSnapshot';
import { NewsBlock } from '../../features/dashboard/components/NewsBlock';
import { RecentNotifications } from '../../features/notifications/components/RecentNotifications';
import { PlanSnapshot } from '../../features/dashboard/components/PlanSnapshot';
import { MarketRail } from '../../features/dashboard/components/MarketRail';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { useMarketTickers } from '../../features/market/hooks/use-market-tickers';
import {
  useOpenPositionCount,
  usePlanCount,
} from '../../features/trading-plan/hooks/use-plans';
import { useWatchlist } from '../../features/watchlist/hooks/use-watchlist';

/**
 * SCR-08 Trader Dashboard (T-112), the Trader's home after sign-in, from
 * the Figma "Trading Overview" frame with the SRS content: watchlist
 * snapshot, active plans and open positions, recent notifications,
 * performance summary and latest news, plus a market snapshot. Only
 * values the backend provides are shown; recent notifications come from
 * the notification center (T-059), the performance summary from the
 * journal statistics (T-051). Plans,
 * watchlist, analysis and journal are one click away (SRS 4).
 */
export function DashboardPage() {
  const copy = useCopy();
  const locale = useLocale();
  // In the interface's language, as the rest of the header (A-45).
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
  const positions = useOpenPositionCount();
  const watchlist = useWatchlist();
  const watched = watchlist.data?.items.length;
  // The chart shows the pair picked in the rail; before that the first
  // watched Spot pair, once the watchlist is known (one candle request).
  const [picked, setPicked] = useState<string | null>(null);
  const spot = pairs.data ?? [];
  const firstWatched = watchlist.data?.items.find(
    (item) =>
      item.spotListed && spot.some((pair) => pair.symbol === item.symbol),
  )?.symbol;
  const shown =
    picked ??
    (watchlist.isPending ? null : (firstWatched ?? spot[0]?.symbol ?? null));
  const chartPair = spot.find((pair) => pair.symbol === shown) ?? null;
  const openCount =
    positions.data === undefined
      ? undefined
      : positions.data.open + (positions.data.more ? '+' : '');

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
    <div className="w-full">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold text-fg">{d.title}</h1>
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
              positions: formatCopy(d.openPositions, {
                count: openCount ?? none,
              }),
            })}
          </p>
        </div>
        <Link
          to="/journal/new"
          className={buttonClassName('secondary', 'md', 'no-underline')}
        >
          {d.manualTrade}
        </Link>
        <Link
          to="/plans/new"
          className={buttonClassName('primary', 'md', 'no-underline')}
        >
          <Plus size={14} aria-hidden="true" />
          {copy.plan.newPlan}
        </Link>
      </header>

      <DashboardKpis
        active={{
          count: active.data,
          max: activeMax,
          note: limitNote(active.data, activeMax),
        }}
        positions={{ count: openCount, note: d.kpiExecutedNote }}
        watchlist={{
          count: watched,
          max: watchMax,
          note: limitNote(watched, watchMax),
        }}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MarketSnapshot
          pair={chartPair}
          ticker={chartPair ? board.tickers.get(chartPair.symbol) : undefined}
        />
        <MarketRail
          pairs={spot}
          tickers={board.tickers}
          selected={chartPair?.symbol ?? null}
          onSelect={setPicked}
        />
      </div>

      <div className="mb-4">
        <PlanSnapshot tickers={board.tickers} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DashboardCard
          title={d.notificationsTitle}
          link={{ to: '/notifications', label: d.openPage }}
        >
          <RecentNotifications />
        </DashboardCard>
        <NewsBlock />
      </div>
    </div>
  );
}
