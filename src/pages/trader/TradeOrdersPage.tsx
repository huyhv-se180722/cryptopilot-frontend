import { useState } from 'react';
import { FormNotice } from '../../components/feedback/FormNotice';
import { PageHeader } from '../../components/layout/PageHeader';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { buttonClassName } from '../../components/ui/button-styles';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { useMarketPairs } from '../../features/market/hooks/use-market-data';
import { DemoTradingBanner } from '../../features/paper-trading/components/DemoTradingBanner';
import { PaperNav } from '../../features/paper-trading/components/PaperNav';
import { PeriodControl } from '../../features/paper-trading/components/PeriodControl';
import {
  PaperPager,
  PaperQueryState,
} from '../../features/paper-trading/components/paper-tables';
import { usePaperColumns } from '../../features/paper-trading/hooks/use-paper-columns';
import {
  useFillHistory,
  useOpenOrders,
  useOrderHistory,
  usePaperActions,
  usePaperPush,
} from '../../features/paper-trading/hooks/use-paper-orders';
import {
  periodStart,
  type Period,
} from '../../features/paper-trading/model/period';
import { paperErrorText } from '../../features/paper-trading/model/paper-errors';
import type { PaperOrder, PaperOrderStatus } from '../../types/domain';

const STATUSES: readonly PaperOrderStatus[] = [
  'FILLED',
  'PARTIALLY_FILLED',
  'CANCELED',
  'EXPIRED',
  'REJECTED',
];

/**
 * Demo orders (D-86, plan section 16, TR-07; designed after the
 * exchange's Order History without a Figma frame): open orders with
 * cancel and cancel all, the order history and the trade history of
 * every pair, filtered by pair, status and period, 20 rows a page. The
 * pair filter lists every Spot pair of the market list.
 */
export function TradeOrdersPage() {
  usePaperPush();
  const copy = useCopy();
  const p = copy.paper;
  const [tab, setTab] = useState('open');
  const [pairId, setPairId] = useState('');
  const [status, setStatus] = useState<PaperOrderStatus | ''>('');
  const [period, setPeriod] = useState<Period>('30');
  const [ordersPage, setOrdersPage] = useState(1);
  const [fillsPage, setFillsPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const pairs = useMarketPairs('spot');
  const { orderColumns, fillColumns } = usePaperColumns(pairs.data ?? []);
  const { cancel, cancelAll } = usePaperActions();
  const from = periodStart(period);
  const filter = {
    pairId: pairId || null,
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
  };
  const open = useOpenOrders(pairId || null);
  const orders = useOrderHistory(filter, ordersPage, tab === 'orders');
  const fills = useFillHistory(filter, fillsPage, tab === 'fills');
  const choices = pairs.data ?? [];

  const restart = () => {
    setOrdersPage(1);
    setFillsPage(1);
  };
  const reset = () => {
    setPairId('');
    setStatus('');
    setPeriod('30');
    restart();
  };
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

  return (
    <div className="mx-auto w-full max-w-7xl">
      <DemoTradingBanner />
      <PaperNav />
      <PageHeader title={p.ordersTitle} description={p.ordersSubtitle} />
      <div
        role="group"
        aria-label={p.filtersLabel}
        className="mb-2 flex flex-wrap items-center gap-3"
      >
        <label className="flex items-center gap-2 text-xs text-muted">
          {p.filterPair}
          <select
            value={pairId}
            onChange={(event) => {
              setPairId(event.target.value);
              restart();
            }}
            className="h-8 rounded-lg border border-line bg-raised px-2 text-xs text-fg"
          >
            <option value="">{p.filterAll}</option>
            {choices.map((item) => (
              <option key={item.pairId} value={item.pairId}>
                {item.symbol}
              </option>
            ))}
          </select>
        </label>
        {tab === 'orders' && (
          <label className="flex items-center gap-2 text-xs text-muted">
            {p.filterStatus}
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as PaperOrderStatus | '');
                restart();
              }}
              className="h-8 rounded-lg border border-line bg-raised px-2 text-xs text-fg"
            >
              <option value="">{p.filterAll}</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {p[`status${value}`]}
                </option>
              ))}
            </select>
          </label>
        )}
        {tab !== 'open' && (
          <PeriodControl
            value={period}
            onChange={(value) => {
              setPeriod(value);
              restart();
            }}
          />
        )}
        <button
          type="button"
          onClick={reset}
          className={buttonClassName('ghost', 'sm')}
        >
          {p.resetFilters}
        </button>
        {tab === 'open' && pairId && (open.data?.length ?? 0) > 0 && (
          <button
            type="button"
            disabled={cancelAll.pending}
            onClick={() =>
              void cancelAll.run(pairId).then((result) => {
                if (result.status === 'error') failed(result.error);
              })
            }
            className={buttonClassName('secondary', 'sm', 'ml-auto')}
          >
            {p.cancelAll}
          </button>
        )}
      </div>
      {notice && <FormNotice tone="error">{notice}</FormNotice>}
      <Tabs
        label={p.ordersTitle}
        value={tab}
        onChange={(id) => {
          setTab(id);
          setNotice(null);
        }}
        items={[
          {
            id: 'open',
            label: p.openOrders,
            ...(open.data ? { count: open.data.length } : {}),
            panel: (
              <PaperQueryState query={open}>
                {() => (
                  <Table
                    caption={p.openOrders}
                    columns={orderColumns(cancelCell)}
                    rows={open.data ?? []}
                    rowKey={(row) => row.orderId}
                    emptyMessage={p.noOpenOrders}
                  />
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
                      rows={orders.data?.items ?? []}
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
                      rows={fills.data?.items ?? []}
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
        ]}
      />
    </div>
  );
}
