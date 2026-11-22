import type { ReactNode } from 'react';
import { KpiStrip, type KpiItem } from '../../../components/layout/KpiStrip';
import { Badge } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  PerformanceAdvanced,
  PerformanceSummary,
} from '../../../types/domain';
import { withSign } from '../../../utils/decimal-sign';
import {
  planAmount,
  planRatio,
} from '../../trading-plan/components/plan-format';
import { AmountValue, PercentValue, RatioValue } from './PerformanceValues';

/** A thin win / loss / breakeven bar under the trade count. */
function WinLossBar({
  summary,
  label,
}: {
  summary: PerformanceSummary;
  label: string;
}) {
  const parts = [
    { size: summary.wins, className: 'bg-positive' },
    { size: summary.losses, className: 'bg-negative' },
    { size: summary.breakeven, className: 'bg-muted-x' },
  ];
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
 * The key figures of SCR-23 on one strip (T-139): net P/L, trades and win
 * rate, then profit factor and max drawdown where the plan includes them
 * (BR-42), then fees and funding; provisional trades are flagged in its
 * header. The server's figures only.
 */
export function PerformanceCards({ summary }: { summary: PerformanceSummary }) {
  const p = useCopy().performance;
  const split = {
    wins: summary.wins,
    losses: summary.losses,
    breakeven: summary.breakeven,
  };
  const advanced = summary.advanced;
  const items: KpiItem[] = [
    {
      id: 'net',
      label: p.totalNetPnl,
      value: <AmountValue value={summary.totalNetPnl} />,
      note: p.kpiNetNote,
    },
    {
      id: 'trades',
      label: p.kpiTradesWinRate,
      value: (
        <>
          <NumericText value={String(summary.trades)} />
          <span className="text-sm text-muted-dim"> · </span>
          <PercentValue value={summary.winRate} />
        </>
      ),
      extra: (
        <WinLossBar
          summary={summary}
          label={formatCopy(p.kpiWinLossBar, split)}
        />
      ),
      note: formatCopy(p.tradesSplit, split),
    },
  ];
  if (advanced)
    items.push(
      {
        id: 'factor',
        label: p.profitFactor,
        value: <RatioValue value={advanced.profitFactor} />,
        note: formatCopy(p.kpiFactorNote, {
          r:
            advanced.averageRealizedR === null
              ? '—'
              : planRatio(advanced.averageRealizedR),
          rr:
            advanced.averagePlannedRiskReward === null
              ? '—'
              : planRatio(advanced.averagePlannedRiskReward),
        }),
      },
      {
        id: 'drawdown',
        label: p.maxDrawdown,
        value: <AmountValue value={advanced.maxDrawdown} plain />,
        note: formatCopy(p.kpiDrawdownNote, {
          count: advanced.maxConsecutiveLosses,
        }),
      },
    );
  items.push({
    id: 'costs',
    label: p.kpiCosts,
    value: <AmountValue value={summary.totalFees} plain />,
    note: formatCopy(p.kpiFundingNote, {
      value:
        summary.totalFunding === null
          ? '—'
          : withSign(planAmount(summary.totalFunding)),
    }),
  });
  return (
    <KpiStrip
      label={p.kpiLabel}
      items={items}
      header={
        summary.provisionalTrades > 0 ? (
          <>
            <Badge tone="warning" withDot>
              {formatCopy(p.provisional, { count: summary.provisionalTrades })}
            </Badge>
            {p.provisionalHint}
          </>
        ) : undefined
      }
    />
  );
}

function Metric({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 border-b border-line px-4 py-2.5">
      <dt className="text-xs text-muted-dim">{label}</dt>
      <dd className="m-0 mt-0.5 font-mono text-sm font-semibold text-fg-2">
        {children}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-x">{hint}</p>}
    </div>
  );
}

/** The metrics of PRO and PREMIUM (BR-42, D-111). */
export function PerformanceAdvancedCard({
  advanced,
}: {
  advanced: PerformanceAdvanced;
}) {
  const p = useCopy().performance;
  return (
    <section
      aria-labelledby="performance-advanced-title"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <h2
        id="performance-advanced-title"
        className="border-b border-line px-4 py-3 text-sm font-semibold text-fg"
      >
        {p.advancedTitle}
      </h2>
      <dl className="m-0 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2">
        <Metric label={p.averageWin}>
          <AmountValue value={advanced.averageWin} />
        </Metric>
        <Metric label={p.averageLoss}>
          <AmountValue value={advanced.averageLoss} />
        </Metric>
        <Metric label={p.largestWin}>
          <AmountValue value={advanced.largestWin} />
        </Metric>
        <Metric label={p.largestLoss}>
          <AmountValue value={advanced.largestLoss} />
        </Metric>
        <Metric label={p.maxDrawdown}>
          <AmountValue value={advanced.maxDrawdown} plain />
        </Metric>
        <Metric label={p.profitFactor}>
          <RatioValue value={advanced.profitFactor} />
        </Metric>
        <Metric label={p.averagePlannedRiskReward}>
          <RatioValue value={advanced.averagePlannedRiskReward} />
        </Metric>
        <Metric
          label={p.averageRealizedR}
          hint={formatCopy(p.tradesWithR, { count: advanced.tradesWithR })}
        >
          <RatioValue value={advanced.averageRealizedR} />
        </Metric>
        <Metric label={p.maxConsecutiveLosses}>
          <NumericText value={String(advanced.maxConsecutiveLosses)} />
        </Metric>
        <Metric label={p.averageEntryDeviationR}>
          <RatioValue value={advanced.averageEntryDeviationR} />
        </Metric>
        <Metric label={p.costOfLateEntryR}>
          <RatioValue value={advanced.costOfLateEntryR} />
        </Metric>
        <Metric label={p.averageMaeR}>
          <RatioValue value={advanced.averageMaeR} />
        </Metric>
        <Metric label={p.averageMfeR}>
          <RatioValue value={advanced.averageMfeR} />
        </Metric>
      </dl>
    </section>
  );
}
