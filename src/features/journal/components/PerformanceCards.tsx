import type { ReactNode } from 'react';
import { StatCard } from '../../../components/layout/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  PerformanceAdvanced,
  PerformanceSummary,
} from '../../../types/domain';
import { AmountValue, PercentValue, RatioValue } from './PerformanceValues';

/** The figures of every plan: counts, win rate, net P/L, fees and funding. */
export function PerformanceCards({ summary }: { summary: PerformanceSummary }) {
  const p = useCopy().performance;
  return (
    <>
      {summary.provisionalTrades > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-dim">
          <Badge tone="warning" withDot>
            {formatCopy(p.provisional, { count: summary.provisionalTrades })}
          </Badge>
          {p.provisionalHint}
        </p>
      )}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={p.trades}
          value={<NumericText value={String(summary.trades)} />}
          status={formatCopy(p.tradesSplit, {
            wins: summary.wins,
            losses: summary.losses,
            breakeven: summary.breakeven,
          })}
        />
        <StatCard
          label={p.winRate}
          value={<PercentValue value={summary.winRate} />}
          accent="accent"
        />
        <StatCard
          label={p.totalNetPnl}
          value={<AmountValue value={summary.totalNetPnl} />}
          accent={
            summary.totalNetPnl?.startsWith('-') ? 'negative' : 'positive'
          }
        />
        <StatCard
          label={p.totalFees}
          value={<AmountValue value={summary.totalFees} plain />}
          accent="warning"
        />
        <StatCard
          label={p.totalFunding}
          value={<AmountValue value={summary.totalFunding} />}
          status={p.totalFundingHint}
          accent="purple"
        />
      </div>
    </>
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
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-dim">{label}</dt>
      <dd className="m-0 mt-0.5 font-mono text-sm font-semibold text-fg-2">
        {children}
      </dd>
      {hint && <p className="mt-0.5 text-[10px] text-muted-x">{hint}</p>}
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
      className="mb-4 rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="performance-advanced-title"
        className="mb-3 text-sm font-semibold text-fg"
      >
        {p.advancedTitle}
      </h2>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-5">
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
