import type { ReactNode } from 'react';
import { useCopy } from '../../../hooks/use-copy';
import type { JournalTrade } from '../../../types/domain';
import { formatInstantLocal } from '../../../utils/instant-format';
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

/** One fact of a trade; `null` is a value the server did not record. */
type FactRow = { label: string; value: ReactNode | null };

function FactGroup({
  id,
  title,
  rows,
  showAll,
}: {
  id: string;
  title: string;
  rows: readonly FactRow[];
  showAll: boolean;
}) {
  const none = useCopy().market.noValue;
  const shown = showAll ? rows : rows.filter((row) => row.value !== null);
  if (shown.length === 0) return null;
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <h2
        id={id}
        className="m-0 border-b border-line px-4 py-2.5 text-[13px] font-semibold text-fg"
      >
        {title}
      </h2>
      <dl className="m-0 px-4 py-1.5">
        {shown.map((row) => (
          <Fact key={row.label} label={row.label}>
            {row.value ?? none}
          </Fact>
        ))}
      </dl>
    </section>
  );
}

/**
 * The execution facts of a trade (SCR-21), in two groups: the entry and
 * the exit. Realized P/L, fees and funding stay apart (D-97); the net is
 * the page's headline. A fact
 * the server did not record is left out until `showAll`, so the page is
 * not a list of dashes; `emptyCount` says how many are hidden.
 */
function tradeFactGroups(
  trade: JournalTrade,
  copy: ReturnType<typeof useCopy>,
) {
  const j = copy.journal;
  const p = copy.plan;
  const price = (value: string | null) =>
    value === null ? null : planPrice(value);
  const time = (value: string | null) =>
    value === null ? null : formatInstantLocal(value);
  const amount = (value: string | null, plain = false) =>
    value === null ? null : <AmountValue value={value} plain={plain} />;
  const entry: FactRow[] = [
    { label: j.columnEntry, value: planPrice(trade.entryPrice) },
    { label: j.columnEntryTime, value: time(trade.entryTime) },
    { label: j.quantity, value: planQuantity(trade.quantity) },
    // Spot has no leverage: the row is left out, not counted as missing.
    ...(trade.leverage === null
      ? []
      : [{ label: j.leverage, value: `${trade.leverage}x` }]),
    { label: j.entryFee, value: amount(trade.entryFee, true) },
    { label: j.stopLoss, value: price(trade.stopLoss) },
    { label: j.takeProfit, value: price(trade.takeProfit) },
  ];
  const exit: FactRow[] = [
    { label: j.columnStatus, value: p[`position${trade.status}`] },
    { label: j.columnExit, value: price(trade.exitPrice) },
    { label: j.exitTime, value: time(trade.exitTime) },
    {
      label: j.closeReason,
      value: trade.closeReason ? p[`close${trade.closeReason}`] : null,
    },
    { label: j.realizedPnl, value: amount(trade.realizedPnl) },
    { label: j.fees, value: amount(trade.feeAmount, true) },
    { label: j.funding, value: amount(trade.fundingFeeAmount) },
  ];
  return { entry, exit };
}

export function TradeFacts({
  trade,
  showAll,
}: {
  trade: JournalTrade;
  showAll: boolean;
}) {
  const copy = useCopy();
  const j = copy.journal;
  const { entry, exit } = tradeFactGroups(trade, copy);
  return (
    <>
      <FactGroup
        id="trade-entry-title"
        title={j.entryGroup}
        rows={entry}
        showAll={showAll}
      />
      <FactGroup
        id="trade-exit-title"
        title={j.exitGroup}
        rows={exit}
        showAll={showAll}
      />
    </>
  );
}
