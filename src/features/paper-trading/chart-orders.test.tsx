// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentPaperTrading } from '../../dev/dev-paper-trading';
import { DEV_PAIR_IDS } from '../../dev/fixtures/market';
import { TradeSpotPage } from '../../pages/trader/TradeSpotPage';
import type {
  MarketFeed,
  MarketService,
  TradingMarketService,
  WatchlistService,
} from '../../services/api/contracts';
import type {
  Candle,
  MarketPair,
  MarketTicker,
  PaperFill,
  PaperOrder,
  WatchlistItem,
} from '../../types/domain';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';
import { fillMarkers, orderLines } from './model/chart-orders';

/** What the trading screen asks the chart library to draw on the price pane. */
const drawn = vi.hoisted(() => ({
  lines: [] as { title: string; price: number }[],
  markers: [] as { shape: string }[],
}));
vi.mock('lightweight-charts', () => ({
  createSeriesMarkers: () => ({
    setMarkers: (markers: typeof drawn.markers) => {
      drawn.markers = markers;
    },
  }),
  CandlestickSeries: { name: 'candles' },
  LineSeries: { name: 'line' },
  HistogramSeries: { name: 'histogram' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: (definition: { name: string }) => ({
      setData: vi.fn(),
      createPriceLine: (line: (typeof drawn.lines)[number]) => {
        if (definition.name === 'candles') drawn.lines.push(line);
        return line;
      },
      removePriceLine: (line: (typeof drawn.lines)[number]) => {
        const at = drawn.lines.indexOf(line);
        if (at >= 0) drawn.lines.splice(at, 1);
      },
      priceToCoordinate: () => 120,
    }),
    panes: () =>
      [0, 1, 2, 3].map(() => ({
        setStretchFactor: vi.fn(),
        getHeight: () => 320,
      })),
    timeScale: () => ({
      fitContent: vi.fn(),
      getVisibleLogicalRange: () => null,
      setVisibleLogicalRange: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      unsubscribeVisibleLogicalRangeChange: vi.fn(),
    }),
    remove: vi.fn(),
  }),
}));

afterEach(() => {
  window.localStorage.clear();
  drawn.lines.length = 0;
  drawn.markers = [];
});

const pair = (symbol: string, base: string, order: number): MarketPair => ({
  pairId: DEV_PAIR_IDS[symbol] as string,
  symbol,
  market: 'spot',
  baseAsset: base,
  quoteAsset: 'USDT',
  baseAssetName: base,
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder: order,
});
const BTC = pair('BTCUSDT', 'BTC', 1);

const HOUR = 3_600_000;
/** Hourly candles up to the current hour, so a fill made now has its bar. */
const candles = (): Candle[] => {
  const last = Math.floor(Date.now() / HOUR) * HOUR;
  return Array.from({ length: 50 }, (_, i) => ({
    openTime: new Date(last - (49 - i) * HOUR).toISOString(),
    open: '60000',
    high: '60100',
    low: '59900',
    close: '60000',
    baseVolume: '1',
    quoteVolume: '60000',
  }));
};

const ticker = (symbol: string) =>
  ({
    market: 'spot',
    symbol,
    sourceTime: new Date().toISOString(),
    lastPrice: '60000',
  }) as MarketTicker;

async function open() {
  const market: MarketService = {
    listPairs: vi.fn(async () => [BTC]),
    getCandles: vi.fn(async () => candles()),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(async (_m, symbol) => ticker(symbol)),
  };
  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview: () => () => undefined,
    subscribeKline: () => () => undefined,
    subscribeTicker: (_m, symbol, listener) => {
      queueMicrotask(() => listener(ticker(symbol)));
      return () => undefined;
    },
  };
  const watched: WatchlistItem = {
    id: 'w-1',
    pairId: DEV_PAIR_IDS.BTCUSDT!,
    symbol: 'BTCUSDT',
    spotListed: true,
    futuresListed: true,
    label: null,
    note: null,
    sortOrder: 0,
    activeAlerts: 0,
    addedAt: '2026-10-01T00:00:00Z',
  };
  const watchlist: WatchlistService = {
    get: vi.fn(async () => ({ items: [watched], limit: null })),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const tradingMarket: TradingMarketService = {
    getDepth: vi.fn(async () => ({
      market: 'spot' as const,
      symbol: 'BTCUSDT',
      lastUpdateId: 1,
      receivedAt: '2026-10-13T00:00:00Z',
      bids: [{ price: '59990.00', quantity: '0.5' }],
      asks: [{ price: '60010.00', quantity: '0.5' }],
    })),
    getTrades: vi.fn(async () => []),
    subscribeDepth: () => () => undefined,
    subscribeTrades: () => () => undefined,
  };
  const { paperTrading } = createDevelopmentPaperTrading(
    async () => testTrader,
    market,
  );
  await renderRoutes(
    [page('/trade/spot/:symbol', <TradeSpotPage />)],
    '/trade/spot/BTCUSDT',
    fakeAuth({ restoreSession: async () => testTrader }),
    { market, marketFeed, watchlist, tradingMarket, paperTrading },
  );
  const form = await screen.findByRole('region', { name: 'Spot order' });
  await waitFor(() => expect(within(form).getByText(/10,000/)).toBeTruthy());
  await screen.findByRole('img', { name: /BTCUSDT 1h candlestick chart/ });
  const user = userEvent.setup();
  const field = (name: RegExp) => within(form).getByRole('textbox', { name });
  const limitBuy = async (price: string, amount: string) => {
    await user.type(field(/Price/), price);
    await user.type(field(/Amount/), amount);
    await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
    await screen.findByText('Buy order open.');
  };
  return { form, user, limitBuy };
}

const order = (patch: Partial<PaperOrder>): PaperOrder => ({
  orderId: 'o-1',
  clientOrderId: 'c-1',
  pairId: 'p-1',
  symbol: 'BTCUSDT',
  market: 'spot',
  side: 'BUY',
  type: 'LIMIT',
  timeInForce: 'GTC',
  price: '59000.00',
  quantity: '0.01',
  quoteOrderQty: null,
  executedQuantity: '0.004',
  cumQuote: '236',
  avgPrice: '59000',
  status: 'PARTIALLY_FILLED',
  statusReason: null,
  placedAt: '2026-10-13T10:00:00Z',
  closedAt: null,
  ...patch,
});

const fill = (patch: Partial<PaperFill>): PaperFill => ({
  fillId: 'f-1',
  orderId: 'o-1',
  pairId: 'p-1',
  symbol: 'BTCUSDT',
  market: 'spot',
  side: 'BUY',
  price: '59000',
  quantity: '0.004',
  quoteAmount: '236',
  fee: '0.000004',
  feeAsset: 'BTC',
  liquidity: 'MAKER',
  source: 'LIVE',
  tradedAt: '2026-10-13T10:00:00Z',
  ...patch,
});

// The screen tests type an order, wait for it and act on it: on a busy
// machine (the whole suite in parallel) that can pass the 5 s default.
const SCREEN_TIMEOUT = 15_000;

describe('demo orders on the trading chart (TR-F5, Spot)', () => {
  it('draws a line per working LIMIT order of the pair with what is still open', () => {
    const select = vi.fn();
    const lines = orderLines(
      [
        order({}),
        order({ orderId: 'o-2', side: 'SELL', price: '61000.00' }),
        order({ orderId: 'o-3', symbol: 'ETHUSDT' }),
        order({ orderId: 'o-4', type: 'MARKET', price: null }),
      ],
      BTC,
      (each, remaining) => `${each.side} ${remaining}`,
      (each) => ({ label: `Cancel ${each.orderId}`, onSelect: select }),
    );
    expect(
      lines.map((line) => [line.id, line.price, line.label, line.tone]),
    ).toEqual([
      ['o-1', '59000.00', 'BUY 0.00600', 'positive'],
      ['o-2', '61000.00', 'SELL 0.00600', 'negative'],
    ]);
    expect(lines[0]?.action?.label).toBe('Cancel o-1');
  });

  it('puts an arrow per fill of the pair, up for a buy and down for a sell', () => {
    expect(
      fillMarkers(
        [
          fill({}),
          fill({ fillId: 'f-2', side: 'SELL' }),
          fill({ fillId: 'f-3', symbol: 'ETHUSDT' }),
        ],
        'BTCUSDT',
      ).map((marker) => [marker.id, marker.direction, marker.tone]),
    ).toEqual([
      ['f-1', 'up', 'positive'],
      ['f-2', 'down', 'negative'],
    ]);
  });

  it(
    'draws a waiting order on the chart and cancels it from its line',
    async () => {
      const { limitBuy, user } = await open();
      await limitBuy('59000', '0.01');
      await waitFor(() =>
        expect(drawn.lines).toContainEqual(
          expect.objectContaining({ price: 59000 }),
        ),
      );
      // The panel row and the chart chip each have a cancel button.
      const onChart = await waitFor(() => {
        const button = screen
          .getAllByRole('button', { name: /Cancel order/ })
          .find((each) => each.hasAttribute('title'));
        expect(button?.parentElement?.textContent).toBe('Buy 0.01000');
        return button!;
      });
      await user.click(onChart);
      await waitFor(() => expect(drawn.lines).toHaveLength(0));
      expect(screen.getByText('No open orders.')).toBeTruthy();
    },
    SCREEN_TIMEOUT,
  );

  it(
    'marks a fill on its candle, and hides orders and fills with the toggle',
    async () => {
      const { form, user, limitBuy } = await open();
      await user.click(within(form).getByRole('radio', { name: 'Market' }));
      await user.type(
        within(form).getByRole('textbox', { name: /Amount/ }),
        '0.01',
      );
      await user.click(within(form).getByRole('button', { name: 'Buy BTC' }));
      await screen.findByText('Buy order filled.');
      await waitFor(() =>
        expect(drawn.markers).toEqual([
          expect.objectContaining({ shape: 'arrowUp' }),
        ]),
      );
      await user.click(within(form).getByRole('radio', { name: 'Limit' }));
      await limitBuy('59000', '0.01');
      await waitFor(() => expect(drawn.lines).toHaveLength(1));

      const toggle = screen.getByRole('button', { name: 'Orders' });
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      await user.click(toggle);
      await waitFor(() => expect(drawn.lines).toHaveLength(0));
      expect(drawn.markers).toEqual([]);
      expect(
        screen
          .getAllByRole('button', { name: /Cancel order/ })
          .some((each) => each.hasAttribute('title')),
      ).toBe(false);
      expect(window.localStorage.getItem('cp-trade-chart-orders')).toBe(
        'false',
      );
    },
    SCREEN_TIMEOUT,
  );
});
