import { useState } from 'react';
import { ErrorState } from '../../../components/feedback/States';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Checkbox } from '../../../components/ui/Checkbox';
import { NumericText } from '../../../components/ui/NumericText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Table, type Column } from '../../../components/ui/Table';
import { Tabs } from '../../../components/ui/Tabs';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf, ServiceError } from '../../../services/api/errors';
import type {
  MarketPair,
  PaperFill,
  PaperOrder,
  PaperPage,
} from '../../../types/domain';
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
import {
  useFillHistory,
  useOpenOrders,
  useOrderHistory,
  usePaperActions,
  usePaperWallet,
} from '../hooks/use-paper-orders';
import { usePaperAccount } from '../hooks/use-paper-account';
import { formatQuantity } from '../model/order-book';
import { TradePanel } from './TradePanel';
import { TransferDialog } from './TransferDialog';

type Tab = 'open' | 'orders' | 'fills' | 'funds';

const time = (value: string) => (
  <time dateTime={value} title={formatInstantUtc(value)}>
    {formatInstantLocal(value)}
  </time>
);

/**
 * Bottom panel of the Spot demo screen (plan section 6.2): open orders
 * with cancel and cancel all, order history, trade history (fills) and
 * the Spot funds with a transfer to Futures. "This pair only" narrows
 * the lists to the pair on screen. Data is read again every few seconds
 * until the backend pushes it (TR-08).
 */
export function OrdersPanel({
  pair,
  pairId,
  pairs,
}: {
  pair: MarketPair;
  pairId: string | null;
  pairs: readonly MarketPair[];
}) {
  const copy = useCopy();
  const p = copy.paper;
  const m = copy.market;
  const [tab, setTab] = useState<string>('open');
  const [onlyThis, setOnlyThis] = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);
  const [fillsPage, setFillsPage] = useState(1);
  const [transferOpen, setTransferOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const filterId = onlyThis ? pairId : null;
  const open = useOpenOrders(filterId);
  const orders = useOrderHistory(filterId, ordersPage, tab === 'orders');
  const fills = useFillHistory(filterId, fillsPage, tab === 'fills');
  const wallet = usePaperWallet('SPOT');
  const { cancel, cancelAll } = usePaperActions();
  const account = usePaperAccount();

  const pairOf = (symbol: string) =>
    pairs.find((each) => each.symbol === symbol);
  // Without the pair's id (FEQ-01) the lists are narrowed by symbol here.
  const mine = <T extends { symbol: string }>(rows: readonly T[]) =>
    onlyThis ? rows.filter((row) => row.symbol === pair.symbol) : rows;
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

  const failed = (error: unknown) => {
    const code = problemOf(error)?.code;
    setNotice(
      code === 'PAPER_ORDER_NOT_OPEN' ? p.orderNotOpen : errorText(copy, error),
    );
  };

  const orderColumns = (withCancel: boolean): Column<PaperOrder>[] => [
    { id: 'time', header: p.colTime, render: (row) => time(row.placedAt) },
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
    withCancel
      ? {
          id: 'cancel',
          header: '',
          render: (row) => (
            <button
              type="button"
              disabled={cancel.pending}
              aria-label={formatCopy(p.cancelOrderLabel, {
                id: row.orderId.slice(-8),
              })}
              onClick={() =>
                void cancel.run(row.orderId).then((result) => {
                  if (result.status === 'error') failed(result.error);
                })
              }
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {p.cancelOrder}
            </button>
          ),
        }
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
    { id: 'time', header: p.colTime, render: (row) => time(row.tradedAt) },
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

  const state = (
    query: {
      isPending: boolean;
      isError: boolean;
      error: unknown;
      refetch: () => unknown;
    },
    content: () => React.ReactNode,
  ) => {
    // Every list waits for the demo account: until it opens, say why.
    if (account.isError) query = account;
    return query.isError ? (
      query.error instanceof ServiceError &&
      query.error.code === 'NOT_CONFIGURED' ? (
        <p className="py-8 text-center text-xs text-muted-dim">
          {errorText(copy, query.error)}
        </p>
      ) : (
        <ErrorState
          message={errorText(copy, query.error)}
          onRetry={() => void query.refetch()}
        />
      )
    ) : query.isPending ? (
      <Skeleton className="h-32 w-full" />
    ) : (
      content()
    );
  };

  const pager = (
    page: PaperPage<unknown> | undefined,
    current: number,
    go: (page: number) => void,
  ) => {
    const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
    if (pages <= 1) return null;
    return (
      <nav className="mt-2 flex items-center justify-end gap-2 text-xs">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => go(current - 1)}
          className={buttonClassName('ghost', 'sm')}
        >
          {copy.plan.previous}
        </button>
        <span className="text-muted-dim">
          {formatCopy(copy.plan.pageOf, { page: current, pages })}
        </span>
        <button
          type="button"
          disabled={current >= pages}
          onClick={() => go(current + 1)}
          className={buttonClassName('ghost', 'sm')}
        >
          {copy.plan.next}
        </button>
      </nav>
    );
  };

  const openRows = mine(open.data ?? []);
  return (
    <TradePanel
      title={p.ordersAndFunds}
      className="mt-2"
      actions={
        <Checkbox
          label={p.thisPairOnly}
          checked={onlyThis}
          onChange={(event) => {
            setOnlyThis(event.target.checked);
            setOrdersPage(1);
            setFillsPage(1);
          }}
        />
      }
    >
      {notice && <FormNotice tone="error">{notice}</FormNotice>}
      <Tabs
        label={p.ordersAndFunds}
        value={tab}
        onChange={(id) => {
          setTab(id as Tab);
          setNotice(null);
        }}
        items={[
          {
            id: 'open',
            label: p.openOrders,
            ...(open.data ? { count: openRows.length } : {}),
            panel: state(open, () => (
              <>
                {onlyThis && pairId && openRows.length > 0 && (
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      disabled={cancelAll.pending}
                      onClick={() =>
                        void cancelAll.run(pairId).then((result) => {
                          if (result.status === 'error') failed(result.error);
                        })
                      }
                      className={buttonClassName('secondary', 'sm')}
                    >
                      {p.cancelAll}
                    </button>
                  </div>
                )}
                <Table
                  caption={p.openOrders}
                  columns={orderColumns(true)}
                  rows={openRows}
                  rowKey={(row) => row.orderId}
                  emptyMessage={p.noOpenOrders}
                />
              </>
            )),
          },
          {
            id: 'orders',
            label: p.orderHistory,
            panel: state(orders, () => (
              <>
                <Table
                  caption={p.orderHistory}
                  columns={orderColumns(false)}
                  rows={mine(orders.data?.items ?? [])}
                  rowKey={(row) => row.orderId}
                  emptyMessage={p.noOrders}
                />
                {pager(orders.data, ordersPage, setOrdersPage)}
              </>
            )),
          },
          {
            id: 'fills',
            label: p.tradeHistory,
            panel: state(fills, () => (
              <>
                <Table
                  caption={p.tradeHistory}
                  columns={fillColumns}
                  rows={mine(fills.data?.items ?? [])}
                  rowKey={(row) => row.fillId}
                  emptyMessage={p.noFills}
                />
                {pager(fills.data, fillsPage, setFillsPage)}
              </>
            )),
          },
          {
            id: 'funds',
            label: p.funds,
            panel: state(wallet, () => (
              <>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-dim">
                    {p.estimatedBalance}{' '}
                    <NumericText
                      className="text-sm font-semibold text-fg"
                      value={groupThousands(
                        toFixedDecimal(wallet.data?.estimatedUsdt ?? '0', 2),
                      )}
                      suffix=" USDT"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => setTransferOpen(true)}
                    className={buttonClassName('secondary', 'sm')}
                  >
                    {p.transfer}
                  </button>
                </div>
                {wallet.data && !wallet.data.complete && (
                  <p className="mb-2 text-[11px] text-warning">
                    {p.incompleteValue}
                  </p>
                )}
                <Table
                  caption={p.funds}
                  columns={[
                    {
                      id: 'coin',
                      header: p.fundsCoin,
                      render: (row) => row.asset,
                    },
                    {
                      id: 'total',
                      header: p.fundsTotal,
                      numeric: true,
                      render: (row) => (
                        <NumericText value={groupThousands(row.total)} />
                      ),
                    },
                    {
                      id: 'free',
                      header: p.fundsFree,
                      numeric: true,
                      render: (row) => (
                        <NumericText value={groupThousands(row.free)} />
                      ),
                    },
                    {
                      id: 'locked',
                      header: p.fundsLocked,
                      numeric: true,
                      render: (row) => (
                        <NumericText value={groupThousands(row.locked)} />
                      ),
                    },
                    {
                      id: 'value',
                      header: p.fundsValue,
                      numeric: true,
                      render: (row) =>
                        row.usdtValue ? money(row.usdtValue) : m.noValue,
                    },
                  ]}
                  rows={wallet.data?.balances ?? []}
                  rowKey={(row) => row.asset}
                  emptyMessage={copy.common.noRecords}
                />
              </>
            )),
          },
        ]}
      />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </TradePanel>
  );
}
