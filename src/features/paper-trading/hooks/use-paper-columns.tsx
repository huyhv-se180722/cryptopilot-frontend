import type { ReactNode } from 'react';
import { NumericText } from '../../../components/ui/NumericText';
import type { Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair, PaperFill, PaperOrder } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  formatPrice,
  groupThousands,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { formatQuantity } from '../model/order-book';

export const timeCell = (value: string) => (
  <time dateTime={value} title={formatInstantUtc(value)}>
    {formatInstantLocal(value)}
  </time>
);

/**
 * Columns of the demo order and trade tables, shared by the trading
 * screen's bottom panel and the Orders page: prices at the pair's tick,
 * amounts at its step, sides coloured and worded, local time with UTC.
 */
export function usePaperColumns(pairs: readonly MarketPair[]) {
  const copy = useCopy();
  const p = copy.paper;
  const m = copy.market;
  const pairOf = (symbol: string) =>
    pairs.find((each) => each.symbol === symbol);
  const label = (symbol: string) => {
    const known = pairOf(symbol);
    return known
      ? `${known.baseAsset ?? symbol}/${known.quoteAsset ?? ''}`
      : symbol;
  };
  const price = (symbol: string, value: string | null) =>
    value ? (
      <NumericText
        value={formatPrice(value, pairOf(symbol)?.tickSize ?? null)}
      />
    ) : (
      m.noValue
    );
  const quantity = (symbol: string, value: string | null) =>
    value ? (
      <NumericText
        value={formatQuantity(value, pairOf(symbol)?.stepSize ?? null)}
      />
    ) : (
      m.noValue
    );
  const side = (value: 'BUY' | 'SELL') => (
    <span className={value === 'BUY' ? 'text-positive' : 'text-negative'}>
      {value === 'BUY' ? p.sideBUY : p.sideSELL}
    </span>
  );
  const money = (value: string) => (
    <NumericText value={groupThousands(toFixedDecimal(value, 2))} />
  );

  /** With `action`, the last column acts on the row (cancel); else status. */
  const orderColumns = (
    action?: (row: PaperOrder) => ReactNode,
  ): Column<PaperOrder>[] => [
    { id: 'time', header: p.colTime, render: (row) => timeCell(row.placedAt) },
    { id: 'pair', header: p.colPair, render: (row) => label(row.symbol) },
    {
      id: 'type',
      header: p.colType,
      render: (row) =>
        row.type === 'LIMIT'
          ? p.typeLIMIT
          : row.type === 'MARKET'
            ? p.typeMARKET
            : row.type,
    },
    { id: 'side', header: p.colSide, render: (row) => side(row.side) },
    {
      id: 'price',
      header: p.colOrderPrice,
      numeric: true,
      render: (row) => price(row.symbol, row.price ?? row.avgPrice),
    },
    {
      id: 'amount',
      header: p.colOrderAmount,
      numeric: true,
      render: (row) =>
        row.quantity
          ? quantity(row.symbol, row.quantity)
          : formatCopy(p.byTotalAmount, {
              total: groupThousands(row.quoteOrderQty ?? ''),
              asset: pairOf(row.symbol)?.quoteAsset ?? '',
            }),
    },
    {
      id: 'filled',
      header: p.colFilled,
      numeric: true,
      render: (row) => quantity(row.symbol, row.executedQuantity),
    },
    {
      id: 'total',
      header: p.colTotal,
      numeric: true,
      render: (row) => money(row.cumQuote),
    },
    action
      ? { id: 'action', header: '', render: action }
      : {
          id: 'status',
          header: p.colStatus,
          render: (row) => (
            <span
              className={classNames(
                row.status === 'FILLED' && 'text-positive',
                (row.status === 'REJECTED' || row.status === 'EXPIRED') &&
                  'text-warning',
              )}
              title={row.statusReason ?? undefined}
            >
              {p[`status${row.status}`]}
            </span>
          ),
        },
  ];

  const fillColumns: Column<PaperFill>[] = [
    { id: 'time', header: p.colTime, render: (row) => timeCell(row.tradedAt) },
    { id: 'pair', header: p.colPair, render: (row) => label(row.symbol) },
    { id: 'side', header: p.colSide, render: (row) => side(row.side) },
    {
      id: 'price',
      header: p.colOrderPrice,
      numeric: true,
      render: (row) => price(row.symbol, row.price),
    },
    {
      id: 'amount',
      header: p.colOrderAmount,
      numeric: true,
      render: (row) => quantity(row.symbol, row.quantity),
    },
    {
      id: 'total',
      header: p.colTotal,
      numeric: true,
      render: (row) => money(row.quoteAmount),
    },
    {
      id: 'fee',
      header: p.colFee,
      numeric: true,
      render: (row) => <NumericText value={`${row.fee} ${row.feeAsset}`} />,
    },
    {
      id: 'role',
      header: p.colRole,
      render: (row) => p[`role${row.liquidity}`],
    },
  ];

  return { orderColumns, fillColumns, money };
}
