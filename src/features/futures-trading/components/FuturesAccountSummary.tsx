import { useState, type ReactNode } from 'react';
import { StatCard } from '../../../components/layout/StatCard';
import { NumericText } from '../../../components/ui/NumericText';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { useFeature } from '../../../hooks/use-entitlement';
import { useServices } from '../../../hooks/use-services';
import { formatCopy } from '../../../i18n/copy';
import type { FuturesClosedPosition } from '../../../types/futures';
import { classNames } from '../../../utils/class-names';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';
import { add } from '../../../utils/decimal-math';
import { formatInstantLocal } from '../../../utils/instant-format';
import { PaperQueryState } from '../../paper-trading/components/paper-tables';
import { useFuturesAccount, useFuturesHistory } from '../hooks/use-futures';
import { closeReasonLabel } from '../model/futures-labels';
import { daysBefore, sumIncome } from '../model/futures-pnl';
import { FuturesAssets } from './FuturesBottomPanel';

/** The most rows the PnL section reads of each history. */
const HISTORY_LIMIT = 1000;
/** The closed positions the PnL section lists. */
const CLOSED_SHOWN = 20;

/** Renders its children only with the Futures feature, so no read is refused. */
function WithFutures({ children }: { children: ReactNode }) {
  return useFeature('FUTURES_ANALYSIS') === 'locked' ? null : <>{children}</>;
}

/** The Futures wallet's margin figures, above its coins on the wallet page. */
export function FuturesWalletSummary() {
  return (
    <WithFutures>
      <WalletSummary />
    </WithFutures>
  );
}

function WalletSummary() {
  const account = useFuturesAccount();
  if (!account.data) return null;
  return (
    <div className="mb-3 rounded-xl border border-line bg-surface p-4">
      <FuturesAssets account={account.data} />
    </div>
  );
}

/**
 * The Futures part of the PnL page (TR-13 for Futures): the open positions'
 * unrealized PnL, what the period realized, paid or received in funding
 * and paid in fees, from the balance changes, and the positions it closed.
 */
export function FuturesPnlSection({ days }: { days: number }) {
  return (
    <WithFutures>
      <FuturesPnl days={days} />
    </WithFutures>
  );
}

function FuturesPnl({ days }: { days: number }) {
  const copy = useCopy();
  const f = copy.futures;
  const none = copy.market.noValue;
  const { futuresTrading } = useServices();
  // The clock is read once, so the period and its query key hold still.
  const [now] = useState(() => Date.now());
  const startTime = daysBefore(now, days);
  const account = useFuturesAccount();
  const income = useFuturesHistory(
    'income',
    { startTime, limit: HISTORY_LIMIT },
    true,
    (q, s) => futuresTrading.income(q, s),
  );
  const closed = useFuturesHistory(
    'positions',
    { startTime, limit: HISTORY_LIMIT },
    true,
    (q, s) => futuresTrading.positionHistory(q, s),
  );
  const sums = income.data ? sumIncome(income.data) : null;
  const signed = (value: string | null | undefined) =>
    value ? (
      <NumericText
        signed
        value={groupThousands(toFixedDecimal(value, 2))}
        suffix=" USDT"
      />
    ) : (
      none
    );
  const tone = (value: string | null | undefined) =>
    value?.startsWith('-') ? 'negative' : 'positive';
  const unrealized = account.data?.totalUnrealizedProfit;

  const columns: Column<FuturesClosedPosition>[] = [
    {
      id: 'symbol',
      header: f.colSymbol,
      render: (c) => (
        <span className="flex flex-col">
          <span className="font-medium text-fg">{c.symbol}</span>
          <span
            className={classNames(
              'text-[10px]',
              c.direction === 'LONG' ? 'text-positive' : 'text-negative',
            )}
          >
            {c.direction} · {formatCopy(f.leverageShort, { n: c.leverage })}
          </span>
        </span>
      ),
    },
    {
      id: 'qty',
      header: f.colAmount,
      numeric: true,
      render: (c) => <NumericText value={groupThousands(c.maxQuantity)} />,
    },
    {
      id: 'pnl',
      header: f.colNetProfit,
      numeric: true,
      render: (c) => signed(c.netProfit),
    },
    {
      id: 'reason',
      header: f.colCloseReason,
      render: (c) =>
        c.closeReason ? closeReasonLabel(f, c.closeReason) : none,
    },
    {
      id: 'closed',
      header: f.colClosed,
      render: (c) => (
        <span className="whitespace-nowrap">
          {c.closeTime ? formatInstantLocal(c.closeTime) : none}
        </span>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="futures-pnl-title"
      className="mt-4 flex flex-col gap-3"
    >
      <h2 id="futures-pnl-title" className="text-sm font-semibold text-fg">
        {formatCopy(f.pnlTitle, { days })}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={f.unrealized}
          value={signed(unrealized)}
          accent={tone(unrealized)}
        />
        <StatCard
          label={f.pnlRealized}
          value={signed(sums?.realized)}
          accent={tone(sums?.realized)}
        />
        <StatCard
          label={f.pnlFundingFees}
          value={signed(sums ? add(sums.funding, sums.fees) : null)}
          status={
            sums
              ? formatCopy(f.pnlFundingFeesSplit, {
                  funding: toFixedDecimal(sums.funding, 2),
                  fees: toFixedDecimal(sums.fees, 2),
                })
              : undefined
          }
          accent={tone(sums ? add(sums.funding, sums.fees) : null)}
        />
        <StatCard
          label={f.pnlNet}
          value={signed(sums?.net)}
          accent={tone(sums?.net)}
        />
      </div>
      <PaperQueryState query={closed}>
        {() => (
          <Table
            caption={formatCopy(f.pnlClosed, { n: CLOSED_SHOWN })}
            columns={columns}
            rows={(closed.data ?? []).slice(0, CLOSED_SHOWN)}
            rowKey={(c) => c.positionId}
            emptyMessage={f.pnlNoClosed}
          />
        )}
      </PaperQueryState>
    </section>
  );
}
