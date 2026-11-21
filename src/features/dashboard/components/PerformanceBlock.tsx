import type { ReactNode } from 'react';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import type { PerformanceFilter } from '../../../types/domain';
import { fractionToPercent } from '../../../utils/decimal-format';
import {
  AmountValue,
  PercentValue,
  RatioValue,
} from '../../journal/components/PerformanceValues';
import { usePerformanceSummary } from '../../journal/hooks/use-performance';
import { DashboardCard, PendingBlock } from './DashboardCard';

/**
 * The default view of SCR-23 (every closed simulated trade), so the
 * figures match the page the block's link opens.
 */
const FILTER: PerformanceFilter = { source: 'SIMULATED' };

function Figure({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
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

/**
 * Performance summary of SCR-08 (T-112): net P/L, win rate and trade
 * count of every closed simulated trade, with the win / loss bar of the
 * Figma frame; average realized R and the largest win only where the
 * plan returns them (PRO and PREMIUM, BR-42). Nothing is computed here.
 */
export function PerformanceBlock() {
  const copy = useCopy();
  const d = copy.dashboard;
  const p = copy.performance;
  const query = usePerformanceSummary(FILTER);
  const summary = query.data;

  let body: ReactNode;
  if (query.isError) {
    body = <PendingBlock message={errorText(copy, query.error)} />;
  } else if (!summary) {
    body = <PendingBlock message={copy.common.loading} />;
  } else if (summary.trades === 0) {
    body = <PendingBlock message={messageText(copy, 'MSG41')} />;
  } else {
    const advanced = summary.advanced;
    const winPercent =
      summary.winRate === null ? null : fractionToPercent(summary.winRate, 2);
    body = (
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <p className="text-[11px] text-muted-dim">{d.performanceScope}</p>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
          <Figure label={p.totalNetPnl}>
            <AmountValue value={summary.totalNetPnl} />
          </Figure>
          <Figure label={p.trades}>
            <NumericText value={String(summary.trades)} />
          </Figure>
          <Figure
            label={p.winRate}
            hint={formatCopy(p.tradesSplit, {
              wins: summary.wins,
              losses: summary.losses,
              breakeven: summary.breakeven,
            })}
          >
            <PercentValue value={summary.winRate} />
          </Figure>
          {advanced && (
            <Figure label={p.averageRealizedR}>
              <RatioValue value={advanced.averageRealizedR} />
            </Figure>
          )}
          {advanced && (
            <Figure label={p.largestWin}>
              <AmountValue value={advanced.largestWin} />
            </Figure>
          )}
        </dl>
        {winPercent !== null && (
          <div
            role="img"
            aria-label={formatCopy(d.performanceBar, {
              rate: winPercent,
              trades: summary.trades,
            })}
            className="mt-auto flex flex-col gap-1.5"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-1.5 rounded-full bg-positive"
                style={{ width: `${winPercent}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-muted-dim">
              {formatCopy(d.performanceBar, {
                rate: winPercent,
                trades: summary.trades,
              })}
            </span>
          </div>
        )}
        {summary.provisionalTrades > 0 && (
          <p className="text-[10px] text-warning">
            {formatCopy(p.provisional, { count: summary.provisionalTrades })}
          </p>
        )}
      </div>
    );
  }

  return (
    <DashboardCard
      title={d.performanceTitle}
      link={{ to: '/performance', label: d.openPage }}
    >
      {body}
    </DashboardCard>
  );
}
