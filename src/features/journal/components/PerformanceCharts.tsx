import { useMemo, useState } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import type {
  Decimal,
  PerformanceBreakdownKind,
  PerformanceBreakdownRow,
  PerformanceFilter,
} from '../../../types/domain';
import {
  MetricChart,
  type MetricLine,
} from '../../chart/components/MetricChart';
import { planAmount } from '../../trading-plan/components/plan-format';
import {
  useEquityCurve,
  usePerformanceBreakdown,
} from '../hooks/use-performance';
import { equityCurve } from '../model/equity-curve';
import { PerformanceLock } from './PerformanceLock';
import { AmountValue, PercentValue, RatioValue } from './PerformanceValues';
import { lockedTier } from './performance-errors';

const CUMULATIVE = '--cp-primary';
const DRAWDOWN = '--cp-negative';

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span
        aria-hidden="true"
        className="h-0.5 w-3 rounded-full"
        style={{ background: `var(${color})` }}
      />
      {label}
    </span>
  );
}

/** The cumulative net P/L and how far it stands under its peak each day. */
export function EquityCurveCard({
  filter,
  from,
}: {
  filter: PerformanceFilter;
  /** The first day of the period; null when counted from the first trade. */
  from: string | null;
}) {
  const copy = useCopy();
  const p = copy.performance;
  const curve = useEquityCurve(filter, true);
  const points = useMemo(
    () => equityCurve(curve.data ?? [], from),
    [curve.data, from],
  );
  const lines = useMemo<readonly MetricLine[]>(() => {
    const line = (
      id: string,
      colorToken: string,
      value: (point: (typeof points)[number]) => Decimal,
    ): MetricLine => ({
      id,
      colorToken,
      scale: 'right',
      format: 'usdt',
      points: points.map((point) => ({
        time: point.day + 'T00:00:00Z',
        value: value(point),
      })),
    });
    return [
      line('cumulative', CUMULATIVE, (point) => point.cumulative),
      line('drawdown', DRAWDOWN, (point) => point.drawdown),
    ];
  }, [points]);

  const tier = curve.isError ? lockedTier(curve.error) : undefined;
  if (tier) return <PerformanceLock title={p.curveTitle} tier={tier} />;
  const last = points.at(-1);
  return (
    <section
      aria-labelledby="performance-curve-title"
      className="min-w-0 rounded-xl border border-line bg-surface p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2
          id="performance-curve-title"
          className="mr-auto text-sm font-semibold text-fg"
        >
          {p.curveTitle}
        </h2>
        <Legend color={CUMULATIVE} label={p.curveCumulative} />
        <Legend color={DRAWDOWN} label={p.curveDrawdown} />
      </div>
      {curve.isPending ? (
        <Skeleton className="h-[220px] w-full" />
      ) : curve.isError ? (
        <ErrorState
          message={errorText(copy, curve.error)}
          onRetry={() => void curve.refetch()}
        />
      ) : last ? (
        <MetricChart
          label={formatCopy(p.curveLabel, {
            value: planAmount(last.cumulative),
          })}
          lines={lines}
          daily
          note={p.curveDays}
        />
      ) : (
        <p className="py-8 text-center text-xs text-muted-dim">
          {messageText(copy, 'MSG41')}
        </p>
      )}
    </section>
  );
}

/** The API's names are English: the ones the app has copy for use it. */
function rowName(
  copy: ReturnType<typeof useCopy>,
  kind: PerformanceBreakdownKind,
  row: PerformanceBreakdownRow,
): string {
  const p = copy.performance;
  if (row.key === null) return p.unassigned;
  if (kind !== 'market') return row.label;
  if (row.key === 'SPOT') return p.marketspot;
  return row.key === 'FUTURES' ? p.marketfutures : row.label;
}

function BreakdownTable({
  kind,
  filter,
}: {
  kind: PerformanceBreakdownKind;
  filter: PerformanceFilter;
}) {
  const copy = useCopy();
  const p = copy.performance;
  const rows = usePerformanceBreakdown(kind, filter, true);
  const title = p[`by${kind}`];
  const columns = useMemo<readonly Column<PerformanceBreakdownRow>[]>(
    () => [
      {
        id: 'name',
        header: p.columnName,
        render: (row) => (
          <span className="font-semibold text-fg">
            {rowName(copy, kind, row)}
          </span>
        ),
      },
      {
        id: 'trades',
        header: p.columnTrades,
        numeric: true,
        render: (row) => row.trades,
      },
      {
        id: 'split',
        header: p.columnSplit,
        numeric: true,
        render: (row) => `${row.wins} / ${row.losses} / ${row.breakeven}`,
      },
      {
        id: 'winRate',
        header: p.columnWinRate,
        numeric: true,
        render: (row) => <PercentValue value={row.winRate} />,
      },
      {
        id: 'netPnl',
        header: p.columnNetPnl,
        numeric: true,
        render: (row) => <AmountValue value={row.netPnl} />,
      },
      {
        id: 'profitFactor',
        header: p.columnProfitFactor,
        numeric: true,
        render: (row) => <RatioValue value={row.profitFactor} />,
      },
      {
        id: 'averageR',
        header: p.columnAverageR,
        numeric: true,
        render: (row) => <RatioValue value={row.averageRealizedR} />,
      },
    ],
    [copy, kind, p],
  );

  const tier = rows.isError ? lockedTier(rows.error) : undefined;
  if (tier) return <PerformanceLock title={title} tier={tier} />;
  if (rows.isPending) return <Skeleton className="m-4 h-24" />;
  if (rows.isError)
    return (
      <div className="p-4">
        <ErrorState
          variant="inline"
          message={errorText(copy, rows.error)}
          onRetry={() => void rows.refetch()}
        />
      </div>
    );
  return (
    <Table
      caption={title}
      columns={columns}
      rows={rows.data}
      rowKey={(row) => row.key ?? 'unassigned'}
      emptyMessage={messageText(copy, 'MSG41')}
      cards
    />
  );
}

const KINDS: readonly PerformanceBreakdownKind[] = [
  'coin',
  'strategy',
  'market',
];

/**
 * By coin, by strategy or by market, the highest net P/L first, one at a
 * time behind tabs (T-139): only the group shown is read.
 */
export function PerformanceBreakdowns({
  filter,
}: {
  filter: PerformanceFilter;
}) {
  const p = useCopy().performance;
  const [kind, setKind] = useState<PerformanceBreakdownKind>('coin');
  return (
    <section
      aria-labelledby="performance-breakdown-title"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2
          id="performance-breakdown-title"
          className="text-sm font-semibold text-fg"
        >
          {p.breakdownTitle}
        </h2>
        <SegmentedControl
          label={p.breakdownGroups}
          value={kind}
          onChange={setKind}
          options={KINDS.map((value) => ({ value, label: p[`by${value}`] }))}
        />
      </div>
      <div className="p-3">
        <BreakdownTable key={kind} kind={kind} filter={filter} />
      </div>
    </section>
  );
}
