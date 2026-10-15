import { useState } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Checkbox } from '../../../components/ui/Checkbox';
import { NumericText } from '../../../components/ui/NumericText';
import { Table } from '../../../components/ui/Table';
import { Tabs } from '../../../components/ui/Tabs';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair, PaperOrder } from '../../../types/domain';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';
import {
  useFillHistory,
  useOpenOrders,
  useOrderHistory,
  usePaperActions,
  usePaperWallet,
} from '../hooks/use-paper-orders';
import { paperErrorText } from '../model/paper-errors';
import { TradePanel } from './TradePanel';
import { usePaperColumns } from '../hooks/use-paper-columns';
import { PaperPager, PaperQueryState } from './paper-tables';
import { TransferDialog } from './TransferDialog';

type Tab = 'open' | 'orders' | 'fills' | 'funds';

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
  const orders = useOrderHistory(
    { pairId: filterId },
    ordersPage,
    tab === 'orders',
  );
  const fills = useFillHistory(
    { pairId: filterId },
    fillsPage,
    tab === 'fills',
  );
  const wallet = usePaperWallet('SPOT');
  const { cancel, cancelAll } = usePaperActions();

  const { orderColumns, fillColumns, money } = usePaperColumns(pairs);
  // Without the pair's id (FEQ-01, older backend) the lists are narrowed
  // by symbol here.
  const mine = <T extends { symbol: string }>(rows: readonly T[]) =>
    onlyThis ? rows.filter((row) => row.symbol === pair.symbol) : rows;

  const failed = (error: unknown) => setNotice(paperErrorText(copy, error));
  const cancelCell = (row: PaperOrder) => (
    <button
      type="button"
      disabled={cancel.pending}
      aria-label={formatCopy(p.cancelOrderLabel, { id: row.orderId.slice(-8) })}
      onClick={() =>
        void cancel.run(row.orderId).then((result) => {
          if (result.status === 'error') failed(result.error);
        })
      }
      className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {p.cancelOrder}
    </button>
  );

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
            panel: (
              <PaperQueryState query={open}>
                {() => (
                  <>
                    {onlyThis && pairId && openRows.length > 0 && (
                      <div className="mb-2 flex justify-end">
                        <button
                          type="button"
                          disabled={cancelAll.pending}
                          onClick={() =>
                            void cancelAll.run(pairId).then((result) => {
                              if (result.status === 'error')
                                failed(result.error);
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
                      columns={orderColumns(cancelCell)}
                      rows={openRows}
                      rowKey={(row) => row.orderId}
                      emptyMessage={p.noOpenOrders}
                    />
                  </>
                )}
              </PaperQueryState>
            ),
          },
          {
            id: 'orders',
            label: p.orderHistory,
            panel: (
              <PaperQueryState query={orders}>
                {() => (
                  <>
                    <Table
                      caption={p.orderHistory}
                      columns={orderColumns()}
                      rows={mine(orders.data?.items ?? [])}
                      rowKey={(row) => row.orderId}
                      emptyMessage={p.noOrders}
                    />
                    <PaperPager
                      page={orders.data}
                      current={ordersPage}
                      onChange={setOrdersPage}
                    />
                  </>
                )}
              </PaperQueryState>
            ),
          },
          {
            id: 'fills',
            label: p.tradeHistory,
            panel: (
              <PaperQueryState query={fills}>
                {() => (
                  <>
                    <Table
                      caption={p.tradeHistory}
                      columns={fillColumns}
                      rows={mine(fills.data?.items ?? [])}
                      rowKey={(row) => row.fillId}
                      emptyMessage={p.noFills}
                    />
                    <PaperPager
                      page={fills.data}
                      current={fillsPage}
                      onChange={setFillsPage}
                    />
                  </>
                )}
              </PaperQueryState>
            ),
          },
          {
            id: 'funds',
            label: p.funds,
            panel: (
              <PaperQueryState query={wallet}>
                {() => (
                  <>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs text-muted-dim">
                        {p.estimatedBalance}{' '}
                        <NumericText
                          className="text-sm font-semibold text-fg"
                          value={groupThousands(
                            toFixedDecimal(
                              wallet.data?.estimatedUsdt ?? '0',
                              2,
                            ),
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
                )}
              </PaperQueryState>
            ),
          },
        ]}
      />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </TradePanel>
  );
}
