import { NumericText } from '../../../components/ui/NumericText';
import { Table } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import type { CoinPnl, SpotPnl } from '../../../types/domain';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';

/**
 * The Spot coins with what they cost and are worth (TR-13), as the
 * exchange's Spot PnL lists them: amount, average cost, last price, value
 * and unrealised PnL with its percent, signed and coloured. A value the
 * backend does not know shows a dash; nothing is derived here.
 */
export function SpotPnlTable({ pnl }: { pnl: SpotPnl }) {
  const copy = useCopy();
  const p = copy.paper;
  const dash = <span className="text-muted-x">{copy.market.noValue}</span>;
  const usdt = (value: string | null) =>
    value ? (
      <NumericText value={groupThousands(toFixedDecimal(value, 2))} />
    ) : (
      dash
    );
  return (
    <>
      <Table<CoinPnl>
        caption={p.pnlCoinsTitle}
        columns={[
          { id: 'coin', header: p.fundsCoin, render: (row) => row.asset },
          {
            id: 'quantity',
            header: p.pnlQuantity,
            numeric: true,
            render: (row) => (
              <NumericText value={groupThousands(row.quantity)} />
            ),
          },
          {
            id: 'cost',
            header: p.pnlAverageCost,
            numeric: true,
            render: (row) => usdt(row.averageCost),
          },
          {
            id: 'last',
            header: p.pnlLastPrice,
            numeric: true,
            render: (row) => usdt(row.lastPrice),
          },
          {
            id: 'value',
            header: p.fundsValue,
            numeric: true,
            render: (row) => usdt(row.value),
          },
          {
            id: 'pnl',
            header: p.pnlUnrealized,
            numeric: true,
            render: (row) =>
              row.unrealizedPnl ? (
                <span className="inline-flex flex-col items-end">
                  <NumericText
                    signed
                    value={groupThousands(toFixedDecimal(row.unrealizedPnl, 2))}
                  />
                  {row.unrealizedPnlPercent && (
                    <NumericText
                      signed
                      className="text-[10px]"
                      value={row.unrealizedPnlPercent}
                      suffix="%"
                    />
                  )}
                </span>
              ) : (
                dash
              ),
          },
        ]}
        rows={pnl.coins}
        rowKey={(row) => row.coinId}
        emptyMessage={p.pnlNoCoins}
      />
      {!pnl.complete && (
        <p className="mt-2 text-[11px] text-muted-dim">{p.pnlIncomplete}</p>
      )}
    </>
  );
}
