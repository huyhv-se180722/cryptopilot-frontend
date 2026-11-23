import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FormNotice } from '../../components/feedback/FormNotice';
import { PageHeader } from '../../components/layout/PageHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { buttonClassName } from '../../components/ui/button-styles';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { FuturesOrdersView } from '../../features/futures-trading/components/FuturesOrdersView';
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
import { useToast } from '../../hooks/use-toast';
import type {
  OrderSide,
  PaperOrder,
  PaperOrderStatus,
  PaperOrderType,
} from '../../types/domain';
import { isPositive } from '../../utils/decimal-math';

/** The Spot order types the order history may be filtered by (B6). */
const TYPES = [
  'LIMIT',
  'MARKET',
  'LIMIT_MAKER',
  'STOP_LOSS',
  'STOP_LOSS_LIMIT',
  'TAKE_PROFIT',
  'TAKE_PROFIT_LIMIT',
] as const satisfies readonly PaperOrderType[];

const STATUSES: readonly PaperOrderStatus[] = [
  'FILLED',
  'PARTIALLY_FILLED',
  'CANCELED',
  'EXPIRED',
  'REJECTED',
];

/**
 * Demo orders (D-86, plan section 16, TR-07; designed after the
 * exchange's Order History without a Figma frame), for Spot or Futures
 * (`?market=futures`). Spot: open orders with cancel and cancel all, the
 * order history and the trade history of every pair, filtered by pair,
 * status and period, 20 rows a page; the pair filter lists every Spot pair
 * of the market list. Futures: the Futures screen's positions and orders
 * panel for a pair.
 */
export function TradeOrdersPage() {
  usePaperPush();
  const copy = useCopy();
  const p = copy.paper;
  const [params, setParams] = useSearchParams();
  const market = params.get('market') === 'futures' ? 'futures' : 'spot';
  return (
    <div className="w-full">
      <DemoTradingBanner />
      <PaperNav />
      <PageHeader title={p.ordersTitle} description={p.ordersSubtitle} />
      <div className="mb-3">
        <SegmentedControl
          label={p.marketLabel}
          value={market}
          onChange={(value) =>
            setParams(value === 'futures' ? { market: value } : {}, {
              replace: true,
            })
          }
          options={[
            { value: 'spot', label: p.tabSpot },
            { value: 'futures', label: p.tabFutures },
          ]}
        />
      </div>
      {market === 'futures' ? <FuturesOrdersView /> : <SpotOrders />}
    </div>
  );
}

function SpotOrders() {
  const copy = useCopy();
  const p = copy.paper;
  const [tab, setTab] = useState('open');
  const [pairId, setPairId] = useState('');
  const [status, setStatus] = useState<PaperOrderStatus | ''>('');
  const [type, setType] = useState<(typeof TYPES)[number] | ''>('');
  const [side, setSide] = useState<OrderSide | ''>('');
  /** B5: the trade history of one order, opened from its row. */
  const [orderId, setOrderId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30');
  const [ordersPage, setOrdersPage] = useState(1);
  const [fillsPage, setFillsPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const pairs = useMarketPairs('spot');
  const { orderColumns, fillColumns } = usePaperColumns(pairs.data ?? []);
  const { cancel, cancelAll, exportHistory } = usePaperActions();
  const toast = useToast();
  const from = periodStart(period);
  const filter = {
    pairId: pairId || null,
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(side ? { side } : {}),
    ...(orderId && tab === 'fills' ? { orderId } : {}),
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
    setType('');
    setSide('');
    setOrderId(null);
    setPeriod('30');
    restart();
  };
  async function save(kind: 'orders' | 'fills') {
    const result = await exportHistory.run(kind, filter);
    if (result.status === 'error') return failed(result.error);
    if (result.status !== 'success') return;
    // A byte order mark, so a spreadsheet reads the file as UTF-8.
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + result.data.csv], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download =
      kind === 'orders'
        ? 'cryptopilot-spot-orders.csv'
        : 'cryptopilot-spot-trades.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.show(
      result.data.truncated
        ? {
            tone: 'info',
            message:
              result.data.matched === null
                ? p.exportCut
                : formatCopy(p.exportCutOf, { matched: result.data.matched }),
          }
        : { tone: 'success', message: p.exportDone },
    );
  }
  const fillsCell = (row: PaperOrder) =>
    isPositive(row.executedQuantity) ? (
      <button
        type="button"
        aria-label={formatCopy(p.orderFillsLabel, {
          id: row.orderId.slice(-8),
        })}
        onClick={() => {
          setOrderId(row.orderId);
          setFillsPage(1);
          setTab('fills');
        }}
        className="text-xs font-medium text-primary hover:underline"
      >
        {p.orderFills}
      </button>
    ) : null;
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
    <>
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
        {tab === 'orders' && (
          <label className="flex items-center gap-2 text-xs text-muted">
            {p.filterType}
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as (typeof TYPES)[number] | '');
                restart();
              }}
              className="h-8 rounded-lg border border-line bg-raised px-2 text-xs text-fg"
            >
              <option value="">{p.filterAll}</option>
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {p[`type${value}`]}
                </option>
              ))}
            </select>
          </label>
        )}
        {tab !== 'open' && (
          <label className="flex items-center gap-2 text-xs text-muted">
            {p.filterSide}
            <select
              value={side}
              onChange={(event) => {
                setSide(event.target.value as OrderSide | '');
                restart();
              }}
              className="h-8 rounded-lg border border-line bg-raised px-2 text-xs text-fg"
            >
              <option value="">{p.filterAll}</option>
              <option value="BUY">{p.sideBUY}</option>
              <option value="SELL">{p.sideSELL}</option>
            </select>
          </label>
        )}
        {tab === 'fills' && orderId && (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-fg">
            {formatCopy(p.filterOrder, { id: orderId.slice(-8) })}
            <button
              type="button"
              aria-label={p.filterOrderClear}
              onClick={() => {
                setOrderId(null);
                setFillsPage(1);
              }}
              className="text-muted hover:text-fg"
            >
              ×
            </button>
          </span>
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
        {tab !== 'open' && (
          <button
            type="button"
            disabled={exportHistory.pending}
            onClick={() => void save(tab === 'orders' ? 'orders' : 'fills')}
            className={buttonClassName('secondary', 'sm', 'ml-auto')}
          >
            {p.exportCsv}
          </button>
        )}
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
                      columns={orderColumns(fillsCell)}
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
    </>
  );
}
