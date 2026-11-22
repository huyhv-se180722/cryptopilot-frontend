import { useState } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { NumericText } from '../../../components/ui/NumericText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { MarketTicker, TradingPlanSummary } from '../../../types/domain';
import { divide, multiply, subtract } from '../../../utils/decimal-math';
import { usePairLookup } from '../../market/hooks/use-market-data';
import { PlanTable } from '../../trading-plan/components/PlanTable';
import { PriceLadder } from '../../trading-plan/components/PriceLadder';
import { planPrice } from '../../trading-plan/components/plan-format';
import { usePlanList } from '../../trading-plan/hooks/use-plans';
import { DashboardCard } from './DashboardCard';

type Shown = 'ACTIVE' | 'EXECUTED';
const ROWS = 5;

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className={className} />
      {label}
    </span>
  );
}

/**
 * Active plans and open positions (SCR-08): the first five of the ACTIVE
 * or the EXECUTED tab of SCR-16 with each plan's stop loss, entry and take
 * profit on one line and how far the live price is from the entry (T-139,
 * A-68). The page reads Spot tickers only, so a Futures plan shows its
 * line without the current price and a dash for the distance: no request
 * is added for them. A row opens SCR-18; rows become cards on a phone.
 */
export function PlanSnapshot({
  tickers,
}: {
  tickers: ReadonlyMap<string, MarketTicker>;
}) {
  const copy = useCopy();
  const d = copy.dashboard;
  const p = copy.plan;
  const none = copy.market.noValue;
  const [tab, setTab] = useState<Shown>('ACTIVE');
  const list = usePlanList({ tab, page: 1 });
  const lookup = usePairLookup();
  const pairOf = (row: TradingPlanSummary) => lookup(row.pairId, row.market);
  const rows = list.data?.items.slice(0, ROWS) ?? [];
  const total = list.data?.total ?? 0;
  /** The live Spot price of a Spot plan's pair; null otherwise. */
  const currentOf = (row: TradingPlanSummary) => {
    if (row.market !== 'spot') return null;
    const pair = pairOf(row);
    return (pair && tickers.get(pair.symbol)?.lastPrice) || null;
  };

  const extra: Column<TradingPlanSummary>[] = [
    {
      id: 'range',
      header: d.planColRange,
      render: (row) => {
        const current = currentOf(row);
        const prices = {
          stopLoss: planPrice(row.stopLoss),
          entry: planPrice(row.entryPrice),
          takeProfit: planPrice(row.takeProfit),
        };
        return (
          <PriceLadder
            stopLoss={row.stopLoss}
            entry={row.entryPrice}
            takeProfit={row.takeProfit}
            current={current}
            className="w-full min-w-32 sm:w-48"
            label={
              current
                ? formatCopy(d.planLadderNow, {
                    ...prices,
                    current: planPrice(current),
                  })
                : formatCopy(d.planLadder, prices)
            }
          />
        );
      },
    },
    {
      id: 'distance',
      header: d.planColDistance,
      numeric: true,
      render: (row) => {
        const current = currentOf(row);
        if (!current) return <span className="text-muted-x">{none}</span>;
        const percent = divide(
          multiply(subtract(current, row.entryPrice), '100'),
          row.entryPrice,
          2,
          'half-up',
        );
        return <NumericText signed value={percent} suffix="%" />;
      },
    },
  ];

  return (
    <DashboardCard
      title={d.plansTitle}
      link={{ to: `/plans?tab=${tab}`, label: d.manage }}
      actions={
        <>
          <SegmentedControl
            label={d.plansView}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'ACTIVE', label: p.tabACTIVE },
              { value: 'EXECUTED', label: p.tabEXECUTED },
            ]}
          />
          <span className="hidden items-center gap-3 text-xs text-muted-dim md:inline-flex">
            <Legend
              className="h-1 w-2.5 rounded-sm bg-negative"
              label={d.planLegendRisk}
            />
            <Legend
              className="h-1 w-2.5 rounded-sm bg-positive"
              label={d.planLegendReward}
            />
            <Legend className="h-2.5 w-0.5 bg-fg" label={d.planLegendNow} />
          </span>
        </>
      }
    >
      {list.isPending ? (
        <Skeleton className="m-4 h-40" />
      ) : list.isError ? (
        <div className="p-4">
          <ErrorState
            variant="inline"
            message={errorText(copy, list.error)}
            onRetry={() => void list.refetch()}
          />
        </div>
      ) : (
        <>
          <PlanTable
            tab={tab}
            rows={rows}
            emptyMessage={p.empty}
            pairOf={pairOf}
            extra={extra}
            showCreated={false}
            cards
          />
          {total > ROWS && (
            <p className="border-t border-line px-4 py-2 text-xs text-muted-dim">
              {formatCopy(d.plansMore, { shown: ROWS, total })}
            </p>
          )}
        </>
      )}
    </DashboardCard>
  );
}
