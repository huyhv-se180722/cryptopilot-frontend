import type { ReactNode } from 'react';
import { useCopy } from '../../../hooks/use-copy';
import type { JournalTrade } from '../../../types/domain';
import { formatInstantLocal } from '../../../utils/instant-format';
import { DirectionText } from '../../trading-plan/components/PlanBadges';
import {
  planPrice,
  planQuantity,
} from '../../trading-plan/components/plan-format';
import { AmountValue } from './PerformanceValues';

export function Fact({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <dt className="text-[11px] text-muted-dim">
        {label}
        {hint && (
          <span className="mt-0.5 block text-[10px] text-muted-x">{hint}</span>
        )}
      </dt>
      <dd className="m-0 text-right font-mono text-xs text-fg-2">{children}</dd>
    </div>
  );
}

/**
 * The execution facts of a trade (SCR-21): realized P/L, fees, funding
 * and net stay apart (D-97).
 */
export function TradeFacts({ trade }: { trade: JournalTrade }) {
  const copy = useCopy();
  const j = copy.journal;
  const p = copy.plan;
  const none = copy.market.noValue;
  const price = (value: string | null) =>
    value === null ? none : planPrice(value);
  const time = (value: string | null) =>
    value === null ? none : formatInstantLocal(value);
  return (
    <dl className="m-0">
      <Fact label={j.columnMarket}>{copy.market[trade.market]}</Fact>
      <Fact label={j.columnDirection}>
        <DirectionText direction={trade.direction} />
      </Fact>
      <Fact label={j.columnSource}>
        {copy.performance[`source${trade.source}`]}
      </Fact>
      <Fact label={j.columnStatus}>{p[`position${trade.status}`]}</Fact>
      {trade.leverage !== null && (
        <Fact label={j.leverage}>{trade.leverage}x</Fact>
      )}
      <Fact label={j.columnEntry}>{planPrice(trade.entryPrice)}</Fact>
      <Fact label={j.quantity}>{planQuantity(trade.quantity)}</Fact>
      <Fact label={j.columnEntryTime}>{time(trade.entryTime)}</Fact>
      <Fact label={j.entryFee}>
        <AmountValue value={trade.entryFee} plain />
      </Fact>
      <Fact label={j.stopLoss}>{price(trade.stopLoss)}</Fact>
      <Fact label={j.takeProfit}>{price(trade.takeProfit)}</Fact>
      <Fact label={j.columnExit}>{price(trade.exitPrice)}</Fact>
      <Fact label={j.exitTime}>{time(trade.exitTime)}</Fact>
      <Fact label={j.closeReason}>
        {trade.closeReason ? p[`close${trade.closeReason}`] : none}
      </Fact>
      <Fact label={j.realizedPnl}>
        <AmountValue value={trade.realizedPnl} />
      </Fact>
      <Fact label={j.fees}>
        <AmountValue value={trade.feeAmount} plain />
      </Fact>
      <Fact label={j.funding}>
        <AmountValue value={trade.fundingFeeAmount} />
      </Fact>
      <Fact label={j.netPnl}>
        <AmountValue value={trade.netPnl} />
      </Fact>
    </dl>
  );
}
