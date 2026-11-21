import { Link } from 'react-router-dom';
import { KpiStrip, type KpiItem } from '../../../components/layout/KpiStrip';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import type { PerformanceFilter } from '../../../types/domain';
import {
  AmountValue,
  PercentValue,
  RatioValue,
} from '../../journal/components/PerformanceValues';
import { usePerformanceSummary } from '../../journal/hooks/use-performance';
import { planRatio } from '../../trading-plan/components/plan-format';

/**
 * The default view of SCR-23 (every closed simulated trade), so the
 * figures match the page the strip's link opens.
 */
const FILTER: PerformanceFilter = { source: 'SIMULATED' };

/** A count, with "of max" when the plan has a limit. */
export interface Counted {
  count: number | undefined;
  /** `null` = no limit on the plan; `undefined` = not known yet. */
  max: number | null | undefined;
  /** The line under the figure (limit left, what it counts). */
  note?: string | undefined;
}

function counted({ count, max }: Counted, none: string) {
  if (count === undefined) return none;
  return typeof max === 'number' ? (
    <>
      {count}
      <span className="text-sm text-muted-dim"> / {max}</span>
    </>
  ) : (
    String(count)
  );
}

/** A thin bar of `part` out of `whole`, for a figure's cell. */
function Bar({
  parts,
  label,
}: {
  parts: readonly { size: number; className: string }[];
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="flex h-1 gap-0.5 overflow-hidden rounded-full bg-raised"
    >
      {parts.map((part, index) =>
        part.size > 0 ? (
          <span
            key={index}
            className={part.className}
            style={{ flexGrow: part.size }}
          />
        ) : null,
      )}
    </span>
  );
}

/**
 * The key figures of SCR-08 (T-139, A-68) on one strip: net P/L, win rate
 * and average realized R of every closed simulated trade, as the server
 * returns them (R only where the plan includes it, BR-42), then the active
 * plans, open positions and watched pairs against the plan limits (D-58,
 * display only). Nothing is computed here.
 */
export function DashboardKpis({
  active,
  positions,
  watchlist,
}: {
  active: Counted;
  positions: { count: string | undefined; note: string };
  watchlist: Counted;
}) {
  const copy = useCopy();
  const d = copy.dashboard;
  const p = copy.performance;
  const none = copy.market.noValue;
  const query = usePerformanceSummary(FILTER);
  const summary = query.data;
  const closed = summary && summary.trades > 0 ? summary : undefined;

  const items: KpiItem[] = [
    {
      id: 'pnl',
      label: d.kpiNetPnl,
      value: closed ? <AmountValue value={closed.totalNetPnl} /> : none,
      note: summary
        ? summary.trades > 0
          ? formatCopy(d.kpiClosedTrades, { count: summary.trades })
          : messageText(copy, 'MSG41')
        : undefined,
    },
    {
      id: 'win-rate',
      label: p.winRate,
      value: closed ? <PercentValue value={closed.winRate} /> : none,
      extra: closed ? (
        <Bar
          label={formatCopy(d.kpiWinLossBar, {
            wins: closed.wins,
            losses: closed.losses,
            breakeven: closed.breakeven,
          })}
          parts={[
            { size: closed.wins, className: 'bg-positive' },
            { size: closed.losses, className: 'bg-negative' },
            { size: closed.breakeven, className: 'bg-muted-x' },
          ]}
        />
      ) : undefined,
      note: closed
        ? formatCopy(p.tradesSplit, {
            wins: closed.wins,
            losses: closed.losses,
            breakeven: closed.breakeven,
          })
        : undefined,
    },
  ];
  const advanced = closed?.advanced;
  if (advanced) {
    items.push({
      id: 'r',
      label: p.averageRealizedR,
      value: <RatioValue value={advanced.averageRealizedR} />,
      note:
        advanced.profitFactor === null
          ? undefined
          : formatCopy(d.kpiProfitFactor, {
              value: planRatio(advanced.profitFactor),
            }),
    });
  }
  items.push(
    {
      id: 'active',
      label: d.kpiActive,
      value: counted(active, none),
      note: active.note,
    },
    {
      id: 'positions',
      label: d.kpiExecuted,
      value: positions.count ?? none,
      note: positions.note,
    },
    {
      id: 'watchlist',
      label: d.kpiWatchlist,
      value: counted(watchlist, none),
      extra:
        typeof watchlist.max === 'number' && watchlist.count !== undefined ? (
          <Bar
            label={formatCopy(d.kpiWatchBar, {
              count: watchlist.count,
              max: watchlist.max,
            })}
            parts={[
              { size: watchlist.count, className: 'bg-primary' },
              {
                size: Math.max(watchlist.max - watchlist.count, 0),
                className: 'bg-transparent',
              },
            ]}
          />
        ) : undefined,
      note: watchlist.note,
    },
  );

  return (
    <KpiStrip
      label={d.kpiLabel}
      className="mb-4"
      header={
        <>
          <span>{d.kpiScope}</span>
          {summary && summary.provisionalTrades > 0 && (
            <span
              className="rounded-full bg-warning-soft px-2 py-px font-semibold text-warning"
              title={p.provisionalHint}
            >
              {formatCopy(p.provisional, {
                count: summary.provisionalTrades,
              })}
            </span>
          )}
          {query.isError && (
            <span role="alert" className="text-negative">
              {errorText(copy, query.error)}
            </span>
          )}
          <Link to="/performance" className="ml-auto font-medium no-underline">
            {d.kpiPerformanceLink} →
          </Link>
        </>
      }
      items={items}
    />
  );
}
