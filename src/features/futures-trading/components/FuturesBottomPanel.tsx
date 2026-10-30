import { useState, type ReactNode } from 'react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Checkbox } from '../../../components/ui/Checkbox';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { NumericText } from '../../../components/ui/NumericText';
import { Table, type Column } from '../../../components/ui/Table';
import { Tabs } from '../../../components/ui/Tabs';
import { useCopy } from '../../../hooks/use-copy';
import { useServices } from '../../../hooks/use-services';
import { formatCopy } from '../../../i18n/copy';
import type { MarketPair } from '../../../types/domain';
import type {
  FuturesAccount,
  FuturesAlgoOrder,
  FuturesClosedPosition,
  FuturesIncome,
  FuturesOrder,
  FuturesPosition,
  FuturesTrade,
} from '../../../types/futures';
import { classNames } from '../../../utils/class-names';
import {
  formatPrice,
  groupThousands,
  toFixedDecimal,
} from '../../../utils/decimal-format';
import { formatInstantLocal } from '../../../utils/instant-format';
import { PaperQueryState } from '../../paper-trading/components/paper-tables';
import { TradePanel } from '../../paper-trading/components/TradePanel';
import {
  useFuturesActions,
  useFuturesHistory,
  useFuturesOpenAlgoOrders,
  useFuturesOpenOrders,
} from '../hooks/use-futures';
import { futuresErrorText } from '../model/futures-errors';
import { roePercent } from '../model/futures-math';
import { ClosePositionDialog } from './ClosePositionDialog';
import { AdjustMarginDialog } from './AdjustMarginDialog';
import { PositionTpSlDialog } from './PositionTpSlDialog';

type Tab =
  'positions' | 'open' | 'orders' | 'trades' | 'income' | 'closed' | 'assets';

const link =
  'text-xs font-medium text-primary hover:underline disabled:opacity-50';

/** The height of a tab's box: by default, and the bounds of a drag. */
const HEIGHT = { initial: 340, min: 160, max: 760 } as const;
const HEIGHT_KEY = 'cryptopilot.trade.futures.panelHeight';

function readHeight(): number {
  try {
    const stored = Number(localStorage.getItem(HEIGHT_KEY));
    return stored >= HEIGHT.min && stored <= HEIGHT.max
      ? stored
      : HEIGHT.initial;
  } catch {
    return HEIGHT.initial;
  }
}

/**
 * The bar above the panel, as the exchange's splitter: dragged up the panel
 * grows, dragged down it shrinks; the height is remembered on the device.
 * The arrow keys move it too.
 */
function ResizeBar({
  height,
  onChange,
  label,
}: {
  height: number;
  onChange: (height: number) => void;
  label: string;
}) {
  const clamp = (value: number) =>
    Math.round(Math.min(HEIGHT.max, Math.max(HEIGHT.min, value)));
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuemin={HEIGHT.min}
      aria-valuemax={HEIGHT.max}
      aria-valuenow={height}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') onChange(clamp(height + 20));
        if (event.key === 'ArrowDown') onChange(clamp(height - 20));
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        const startY = event.clientY;
        const start = height;
        const move = (moved: PointerEvent) =>
          onChange(clamp(start + startY - moved.clientY));
        const stop = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', stop);
          document.body.style.removeProperty('user-select');
        };
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
      }}
      className="group flex h-3 cursor-row-resize items-center justify-center focus:outline-none"
    >
      <span className="h-1 w-12 rounded-full bg-line transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
    </div>
  );
}

/**
 * The bottom panel of the Futures screen, as the exchange's (plan 12.2):
 * positions with their close, margin and TP/SL actions; the orders waiting,
 * ordinary and conditional, with cancel; the order, trade, balance change
 * and position histories; the Futures assets. "This pair only" narrows the
 * lists to the pair on screen.
 */
export function FuturesBottomPanel({
  pair,
  positions,
  ticks,
  account,
}: {
  pair: MarketPair;
  positions: readonly FuturesPosition[] | undefined;
  /** Tick sizes by symbol, for prices of other pairs. */
  ticks: ReadonlyMap<string, string | null>;
  account: FuturesAccount | undefined;
}) {
  const copy = useCopy();
  const f = copy.futures;
  const none = copy.market.noValue;
  const { futuresTrading } = useServices();
  const [tab, setTab] = useState<Tab>('positions');
  const [height, setHeight] = useState(readHeight);
  const resize = (next: number) => {
    setHeight(next);
    try {
      localStorage.setItem(HEIGHT_KEY, String(next));
    } catch {
      // A private window keeps no height; the default returns next time.
    }
  };
  // Each tab's content scrolls in a box of the panel's height, the tabs in
  // view, as the exchange's bottom panel.
  const scroll = (content: ReactNode) => (
    <div style={{ height }} className="overflow-auto overscroll-contain">
      {content}
    </div>
  );
  const [onlyThis, setOnlyThis] = useState(false);
  const [waiting, setWaiting] = useState<'ordinary' | 'conditional'>(
    'ordinary',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [closing, setClosing] = useState<{
    position: FuturesPosition;
    type: 'MARKET' | 'LIMIT';
  } | null>(null);
  const [adjusting, setAdjusting] = useState<FuturesPosition | null>(null);
  const [tpsl, setTpsl] = useState<FuturesPosition | null>(null);
  const symbol = onlyThis ? pair.symbol : null;
  const open = useFuturesOpenOrders(symbol);
  const algo = useFuturesOpenAlgoOrders(symbol);
  const { cancel, cancelAll, cancelAlgo, close } = useFuturesActions();
  const history = { symbol: pair.symbol, limit: 100 };
  const orders = useFuturesHistory(
    'orders',
    history,
    tab === 'orders',
    (q, s) => futuresTrading.allOrders({ ...q, symbol: pair.symbol }, s),
  );
  const trades = useFuturesHistory(
    'trades',
    history,
    tab === 'trades',
    (q, s) => futuresTrading.userTrades({ ...q, symbol: pair.symbol }, s),
  );
  const income = useFuturesHistory(
    'income',
    { limit: 100, ...(symbol ? { symbol } : {}) },
    tab === 'income',
    (q, s) => futuresTrading.income(q, s),
  );
  const closed = useFuturesHistory(
    'positions',
    { limit: 100, ...(symbol ? { symbol } : {}) },
    tab === 'closed',
    (q, s) => futuresTrading.positionHistory(q, s),
  );

  const failed = (error: unknown) => setNotice(futuresErrorText(copy, error));
  const tickOf = (s: string) => ticks.get(s) ?? null;
  const price = (s: string, value: string | null) =>
    value && !/^0(\.0+)?$/.test(value) ? (
      <NumericText value={formatPrice(value, tickOf(s))} />
    ) : (
      none
    );
  const usdt = (value: string) => (
    <NumericText signed value={toFixedDecimal(value, 2)} />
  );
  const time = (value: string) => (
    <span className="whitespace-nowrap">{formatInstantLocal(value)}</span>
  );
  const sideText = (side: 'BUY' | 'SELL', positionSide: string) => (
    <span className={side === 'BUY' ? 'text-positive' : 'text-negative'}>
      {side === 'BUY' ? f.buy : f.sell}
      {positionSide !== 'BOTH' ? ' · ' + positionSide : ''}
    </span>
  );

  const shownPositions = (positions ?? []).filter(
    (p) => !onlyThis || p.symbol === pair.symbol,
  );
  const positionColumns: Column<FuturesPosition>[] = [
    {
      id: 'symbol',
      header: f.colSymbol,
      render: (p) => (
        <span className="flex flex-col">
          <span className="font-medium text-fg">{p.symbol}</span>
          <span className="text-[10px] text-muted">
            {p.marginType === 'CROSSED' ? f.cross : f.isolated}{' '}
            {formatCopy(f.leverageShort, { n: p.leverage })}
            {p.positionSide !== 'BOTH' ? ' · ' + p.positionSide : ''}
          </span>
        </span>
      ),
    },
    {
      id: 'size',
      header: f.colSize,
      numeric: true,
      render: (p) => (
        <span
          className={classNames(
            'flex flex-col items-end',
            p.positionAmt.startsWith('-') ? 'text-negative' : 'text-positive',
          )}
        >
          <NumericText value={groupThousands(p.positionAmt)} />
          <span className="text-[10px] text-muted">
            <NumericText
              value={groupThousands(
                toFixedDecimal(p.notional.replace('-', ''), 2),
              )}
              suffix=" USDT"
            />
          </span>
        </span>
      ),
    },
    {
      id: 'entry',
      header: f.colEntry,
      numeric: true,
      render: (p) => price(p.symbol, p.entryPrice),
    },
    {
      id: 'breakEven',
      header: f.colBreakEven,
      numeric: true,
      render: (p) => price(p.symbol, p.breakEvenPrice),
    },
    {
      id: 'mark',
      header: f.colMark,
      numeric: true,
      render: (p) => price(p.symbol, p.markPrice),
    },
    {
      id: 'liq',
      header: f.colLiq,
      numeric: true,
      render: (p) => (
        <span className="text-warning">
          {price(p.symbol, p.liquidationPrice)}
        </span>
      ),
    },
    {
      id: 'ratio',
      header: f.marginRatio,
      numeric: true,
      render: (p) =>
        p.marginRatio ? (
          <NumericText
            value={(Number(p.marginRatio) * 100).toFixed(2)}
            suffix="%"
          />
        ) : (
          none
        ),
    },
    {
      id: 'margin',
      header: f.colMargin,
      numeric: true,
      render: (p) => (
        <span className="inline-flex items-center gap-1">
          <span className="flex flex-col items-end">
            <NumericText
              value={groupThousands(
                toFixedDecimal(
                  p.marginType === 'ISOLATED'
                    ? p.isolatedMargin
                    : p.positionInitialMargin,
                  2,
                ),
              )}
              suffix=" USDT"
            />
            <span className="text-[10px] text-muted">
              {p.marginType === 'ISOLATED' ? f.isolatedMargin : f.crossMargin}
            </span>
          </span>
          {p.marginType === 'ISOLATED' && (
            <button
              type="button"
              className={link}
              aria-label={f.adjustMargin}
              onClick={() => setAdjusting(p)}
            >
              ✎
            </button>
          )}
        </span>
      ),
    },
    {
      id: 'pnl',
      header: f.colPnl,
      numeric: true,
      render: (p) => (
        <span className="flex flex-col items-end">
          {usdt(p.unRealizedProfit)}
          <span className="text-[10px]">
            <NumericText
              signed
              value={roePercent(p.unRealizedProfit, p.positionInitialMargin)}
              suffix="%"
            />
          </span>
        </span>
      ),
    },
    {
      id: 'actions',
      header: f.colClose,
      render: (p) => (
        <span className="flex gap-2">
          <button
            type="button"
            className={link}
            onClick={() => setClosing({ position: p, type: 'MARKET' })}
          >
            {f.closeMarket}
          </button>
          <button
            type="button"
            className={link}
            onClick={() => setClosing({ position: p, type: 'LIMIT' })}
          >
            {f.closeLimit}
          </button>
          <button type="button" className={link} onClick={() => setTpsl(p)}>
            {f.tpsl}
          </button>
        </span>
      ),
    },
  ];

  const orderColumns: Column<FuturesOrder>[] = [
    { id: 'time', header: f.colTime, render: (o) => time(o.time) },
    { id: 'symbol', header: f.colSymbol, render: (o) => o.symbol },
    {
      id: 'type',
      header: f.colType,
      render: (o) =>
        o.type +
        (o.type === 'LIMIT' ? ' · ' + o.timeInForce : '') +
        (o.reduceOnly ? ' · ' + f.reduceOnlyShort : ''),
    },
    {
      id: 'side',
      header: f.colSide,
      render: (o) => sideText(o.side, o.positionSide),
    },
    {
      id: 'price',
      header: f.colPrice,
      numeric: true,
      render: (o) =>
        o.type === 'MARKET' ? f.marketPrice : price(o.symbol, o.price),
    },
    {
      id: 'filled',
      header: f.colFilled,
      numeric: true,
      render: (o) => (
        <NumericText
          value={
            groupThousands(o.executedQty) + ' / ' + groupThousands(o.origQty)
          }
        />
      ),
    },
  ];
  const cancelColumn: Column<FuturesOrder> = {
    id: 'cancel',
    header: '',
    render: (o) => (
      <button
        type="button"
        className={link}
        disabled={cancel.pending}
        onClick={() =>
          void cancel.run(o.symbol, o.orderId).then((r) => {
            if (r.status === 'error') failed(r.error);
          })
        }
      >
        {f.cancel}
      </button>
    ),
  };
  const statusColumn: Column<FuturesOrder> = {
    id: 'status',
    header: f.colStatus,
    render: (o) => (
      <span title={o.statusReason ?? undefined}>
        {o.status}
        {o.statusReason ? ' · ' + o.statusReason : ''}
      </span>
    ),
  };

  const algoColumns: Column<FuturesAlgoOrder>[] = [
    { id: 'time', header: f.colTime, render: (o) => time(o.createTime) },
    { id: 'symbol', header: f.colSymbol, render: (o) => o.symbol },
    { id: 'type', header: f.colType, render: (o) => o.orderType },
    {
      id: 'side',
      header: f.colSide,
      render: (o) => sideText(o.side, o.positionSide),
    },
    {
      id: 'trigger',
      header: f.colTrigger,
      numeric: true,
      render: (o) => (
        <span>
          {o.triggerPrice
            ? price(o.symbol, o.triggerPrice)
            : o.priceRate
              ? o.priceRate + '%'
              : none}{' '}
          <span className="text-[10px] text-muted">
            {o.workingType === 'MARK_PRICE' ? f.markShort : f.lastShort}
          </span>
        </span>
      ),
    },
    {
      id: 'amount',
      header: f.colAmount,
      numeric: true,
      render: (o) =>
        o.closePosition
          ? f.closePositionShort
          : groupThousands(o.quantity ?? ''),
    },
    {
      id: 'cancel',
      header: '',
      render: (o) => (
        <button
          type="button"
          className={link}
          disabled={cancelAlgo.pending}
          onClick={() =>
            void cancelAlgo.run(o.symbol, o.algoId).then((r) => {
              if (r.status === 'error') failed(r.error);
            })
          }
        >
          {f.cancel}
        </button>
      ),
    },
  ];

  const tradeColumns: Column<FuturesTrade>[] = [
    { id: 'time', header: f.colTime, render: (t) => time(t.time) },
    {
      id: 'side',
      header: f.colSide,
      render: (t) => sideText(t.side, t.positionSide),
    },
    {
      id: 'price',
      header: f.colPrice,
      numeric: true,
      render: (t) => price(t.symbol, t.price),
    },
    {
      id: 'qty',
      header: f.colAmount,
      numeric: true,
      render: (t) => <NumericText value={groupThousands(t.qty)} />,
    },
    {
      id: 'realized',
      header: f.colRealized,
      numeric: true,
      render: (t) => usdt(t.realizedPnl),
    },
    {
      id: 'role',
      header: f.colRole,
      render: (t) => (t.maker ? f.maker : f.taker),
    },
  ];

  const incomeColumns: Column<FuturesIncome>[] = [
    { id: 'time', header: f.colTime, render: (i) => time(i.time) },
    { id: 'symbol', header: f.colSymbol, render: (i) => i.symbol ?? none },
    {
      id: 'type',
      header: f.colIncomeType,
      render: (i) => incomeLabel(f, i.incomeType),
    },
    {
      id: 'amount',
      header: f.colAmount,
      numeric: true,
      render: (i) => (
        <NumericText
          signed
          value={toFixedDecimal(i.income, 4)}
          suffix=" USDT"
        />
      ),
    },
  ];

  const closedColumns: Column<FuturesClosedPosition>[] = [
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
            {c.direction} · {c.marginType === 'CROSSED' ? f.cross : f.isolated}{' '}
            {formatCopy(f.leverageShort, { n: c.leverage })}
          </span>
        </span>
      ),
    },
    {
      id: 'entry',
      header: f.colEntry,
      numeric: true,
      render: (c) => price(c.symbol, c.entryPrice),
    },
    {
      id: 'close',
      header: f.colClosePrice,
      numeric: true,
      render: (c) => price(c.symbol, c.avgClosePrice),
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
      render: (c) => usdt(c.netProfit),
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
      render: (c) => (c.closeTime ? time(c.closeTime) : none),
    },
  ];

  const openRows = open.data ?? [];
  return (
    <div>
      <ResizeBar height={height} onChange={resize} label={f.resizePanel} />
      <TradePanel
        title={f.bottomTitle}
        actions={
          <Checkbox
            label={copy.paper.thisPairOnly}
            checked={onlyThis}
            onChange={(event) => setOnlyThis(event.target.checked)}
          />
        }
      >
        {notice && <FormNotice tone="error">{notice}</FormNotice>}
        <Tabs
          label={f.bottomTitle}
          value={tab}
          onChange={(id) => {
            setTab(id as Tab);
            setNotice(null);
          }}
          items={[
            {
              id: 'positions',
              label: f.tabPositions,
              count: shownPositions.length,
              panel: scroll(
                <>
                  {shownPositions.length > 0 && (
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        className={link}
                        disabled={close.pending}
                        onClick={() =>
                          void Promise.all(
                            shownPositions.map((p) =>
                              close.run({
                                symbol: p.symbol,
                                positionSide: p.positionSide,
                                type: 'MARKET',
                              }),
                            ),
                          ).then((results) => {
                            const error = results.find(
                              (r) => r.status === 'error',
                            );
                            if (error && error.status === 'error')
                              failed(error.error);
                          })
                        }
                      >
                        {f.closeAll}
                      </button>
                    </div>
                  )}
                  <Table
                    caption={f.tabPositions}
                    columns={positionColumns}
                    rows={shownPositions}
                    rowKey={(p) => p.symbol + p.positionSide}
                    emptyMessage={f.noPositions}
                  />
                </>,
              ),
            },
            {
              id: 'open',
              label: f.tabOpenOrders,
              ...(open.data && algo.data
                ? { count: openRows.length + algo.data.length }
                : {}),
              panel: scroll(
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <SegmentedControl
                      label={f.tabOpenOrders}
                      value={waiting}
                      onChange={setWaiting}
                      options={[
                        {
                          value: 'ordinary',
                          label:
                            f.waitingOrdinary +
                            (open.data ? ' (' + openRows.length + ')' : ''),
                        },
                        {
                          value: 'conditional',
                          label:
                            f.tabAlgo +
                            (algo.data ? ' (' + algo.data.length + ')' : ''),
                        },
                      ]}
                    />
                    {waiting === 'ordinary' && openRows.length > 0 && (
                      <button
                        type="button"
                        className={link}
                        disabled={cancelAll.pending}
                        onClick={() =>
                          void cancelAll.run(pair.symbol).then((r) => {
                            if (r.status === 'error') failed(r.error);
                          })
                        }
                      >
                        {formatCopy(f.cancelAllOf, { symbol: pair.symbol })}
                      </button>
                    )}
                  </div>
                  {waiting === 'ordinary' ? (
                    <PaperQueryState query={open}>
                      {() => (
                        <Table
                          caption={f.waitingOrdinary}
                          columns={[...orderColumns, cancelColumn]}
                          rows={openRows}
                          rowKey={(o) => o.orderId}
                          emptyMessage={f.noOrders}
                        />
                      )}
                    </PaperQueryState>
                  ) : (
                    <PaperQueryState query={algo}>
                      {() => (
                        <Table
                          caption={f.tabAlgo}
                          columns={algoColumns}
                          rows={algo.data ?? []}
                          rowKey={(o) => o.algoId}
                          emptyMessage={f.noOrders}
                        />
                      )}
                    </PaperQueryState>
                  )}
                </>,
              ),
            },
            {
              id: 'orders',
              label: f.tabOrderHistory,
              panel: scroll(
                <PaperQueryState query={orders}>
                  {() => (
                    <Table
                      caption={f.tabOrderHistory}
                      columns={[...orderColumns, statusColumn]}
                      rows={[...(orders.data ?? [])].reverse()}
                      rowKey={(o) => o.orderId}
                      emptyMessage={formatCopy(f.noHistoryOf, {
                        symbol: pair.symbol,
                      })}
                    />
                  )}
                </PaperQueryState>,
              ),
            },
            {
              id: 'trades',
              label: f.tabTradeHistory,
              panel: scroll(
                <PaperQueryState query={trades}>
                  {() => (
                    <Table
                      caption={f.tabTradeHistory}
                      columns={tradeColumns}
                      rows={[...(trades.data ?? [])].reverse()}
                      rowKey={(t) => t.id}
                      emptyMessage={formatCopy(f.noHistoryOf, {
                        symbol: pair.symbol,
                      })}
                    />
                  )}
                </PaperQueryState>,
              ),
            },
            {
              id: 'income',
              label: f.tabTransactions,
              panel: scroll(
                <PaperQueryState query={income}>
                  {() => (
                    <Table
                      caption={f.tabTransactions}
                      columns={incomeColumns}
                      rows={income.data ?? []}
                      rowKey={(i) => i.tranId + i.incomeType}
                      emptyMessage={f.noRows}
                    />
                  )}
                </PaperQueryState>,
              ),
            },
            {
              id: 'closed',
              label: f.tabPositionHistory,
              panel: scroll(
                <PaperQueryState query={closed}>
                  {() => (
                    <Table
                      caption={f.tabPositionHistory}
                      columns={closedColumns}
                      rows={closed.data ?? []}
                      rowKey={(c) => c.positionId}
                      emptyMessage={f.noRows}
                    />
                  )}
                </PaperQueryState>,
              ),
            },
            {
              id: 'assets',
              label: f.tabAssets,
              panel: scroll(<FuturesAssets account={account} />),
            },
          ]}
        />
        {closing && (
          <ClosePositionDialog
            position={closing.position}
            type={closing.type}
            tickSize={tickOf(closing.position.symbol)}
            onClose={() => setClosing(null)}
          />
        )}
        {adjusting && (
          <AdjustMarginDialog
            position={adjusting}
            onClose={() => setAdjusting(null)}
          />
        )}
        {tpsl && (
          <PositionTpSlDialog
            position={tpsl}
            tickSize={tickOf(tpsl.symbol)}
            onClose={() => setTpsl(null)}
          />
        )}
      </TradePanel>
    </div>
  );
}

type FuturesCopy = ReturnType<typeof useCopy>['futures'];

function incomeLabel(f: FuturesCopy, type: string): string {
  const labels: Record<string, string> = {
    TRANSFER: f.incomeTransfer,
    REALIZED_PNL: f.incomeRealized,
    FUNDING_FEE: f.incomeFunding,
    COMMISSION: f.incomeCommission,
    INSURANCE_CLEAR: f.incomeLiquidationFee,
    INSURANCE_COVER: f.incomeInsurance,
  };
  return labels[type] ?? type;
}

function closeReasonLabel(f: FuturesCopy, reason: string): string {
  const labels: Record<string, string> = {
    MANUAL: f.reasonManual,
    TAKE_PROFIT: f.reasonTakeProfit,
    STOP_LOSS: f.reasonStopLoss,
    LIQUIDATION: f.reasonLiquidation,
    REDUCE: f.reasonReduce,
    SYSTEM: f.reasonSystem,
  };
  return labels[reason] ?? reason;
}

/** The Futures wallet in USDT, as the exchange's Assets tab. */
function FuturesAssets({ account }: { account: FuturesAccount | undefined }) {
  const copy = useCopy();
  const f = copy.futures;
  if (!account)
    return <p className="text-xs text-muted">{copy.common.loading}</p>;
  const rows: [string, string, boolean][] = [
    [f.walletBalance, account.totalWalletBalance, false],
    [f.unrealized, account.totalUnrealizedProfit, true],
    [f.marginBalance, account.totalMarginBalance, false],
    [f.positionMarginTotal, account.totalPositionInitialMargin, false],
    [f.orderMarginTotal, account.totalOpenOrderInitialMargin, false],
    [f.available, account.availableBalance, false],
    [f.maxTransfer, account.maxWithdrawAmount, false],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
      <div className="col-span-full text-[11px] font-semibold text-fg">
        USDT
      </div>
      {rows.map(([label, value, signed]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-[10px] text-muted-dim">{label}</dt>
          <dd className="text-fg-2">
            <NumericText
              signed={signed}
              value={groupThousands(toFixedDecimal(value, 2))}
              suffix=" USDT"
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
