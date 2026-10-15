// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradeSpotPage } from '../../pages/trader/TradeSpotPage';
import type {
  MarketFeed,
  MarketService,
  PaperTradingService,
  WatchlistService,
} from '../../services/api/contracts';
import type {
  MarketOverview,
  MarketPair,
  MarketTicker,
  WatchlistItem,
} from '../../types/domain';
import { createPendingPaperTradingService } from '../../services/api/paper-trading';
import { fakeAuth, page, renderRoutes, testTrader } from '../../test/render';

/** What the screen asks of the chart's time scale. */
const view = vi.hoisted(() => ({
  range: { from: 0, to: 0 },
  set: [] as { from: number; to: number }[],
  onRange: null as ((range: { from: number; to: number }) => void) | null,
  bars: 0,
}));
vi.mock('lightweight-charts', () => ({
  createSeriesMarkers: () => ({ setMarkers: vi.fn() }),
  CandlestickSeries: { name: 'candles' },
  LineSeries: { name: 'line' },
  HistogramSeries: { name: 'histogram' },
  ColorType: { Solid: 'solid' },
  createChart: () => ({
    addSeries: (definition: { name: string }) => ({
      setData: (data: unknown[]) => {
        if (definition.name === 'candles') view.bars = data.length;
      },
      createPriceLine: vi.fn(),
      removePriceLine: vi.fn(),
    }),
    panes: () => [0, 1, 2, 3].map(() => ({ setStretchFactor: vi.fn() })),
    timeScale: () => ({
      fitContent: vi.fn(),
      getVisibleLogicalRange: () => view.range,
      setVisibleLogicalRange: (range: { from: number; to: number }) => {
        view.range = range;
        view.set.push(range);
      },
      subscribeVisibleLogicalRangeChange: (
        listener: (range: { from: number; to: number }) => void,
      ) => {
        view.onRange = listener;
      },
      unsubscribeVisibleLogicalRangeChange: () => {
        view.onRange = null;
      },
    }),
    remove: vi.fn(),
  }),
}));

const HOUR = 3_600_000;
const START = Date.UTC(2026, 8, 1);
const candleAt = (index: number) => ({
  openTime: new Date(START + index * HOUR).toISOString(),
  open: '100',
  high: '101',
  low: '99',
  close: '100',
  baseVolume: '10',
  quoteVolume: '1000',
});

afterEach(() => {
  window.localStorage.clear();
  view.set.length = 0;
  view.onRange = null;
  view.bars = 0;
});

const pair = (
  symbol: string,
  baseAsset: string,
  baseAssetName: string,
  displayOrder: number,
): MarketPair => ({
  symbol,
  market: 'spot',
  baseAsset,
  quoteAsset: 'USDT',
  baseAssetName,
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder,
});
const PAIRS = [
  pair('BTCUSDT', 'BTC', 'Bitcoin', 1),
  pair('ETHUSDT', 'ETH', 'Ethereum', 2),
  pair('SOLUSDT', 'SOL', 'Solana', 3),
];

const ticker = (
  symbol: string,
  lastPrice: string,
  changePercent24h: string,
  quoteVolume24h: string,
): MarketTicker => ({
  market: 'spot',
  symbol,
  sourceTime: new Date().toISOString(),
  lastPrice,
  bestBid: null,
  bestAsk: null,
  high24h: '63950.00',
  low24h: '61820.50',
  changePercent24h,
  baseVolume24h: '18234.11',
  quoteVolume24h,
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
});

const watched = (symbol: string): WatchlistItem => ({
  id: 'w-' + symbol,
  pairId: 'p-' + symbol,
  symbol,
  spotListed: true,
  futuresListed: false,
  label: null,
  note: null,
  sortOrder: 0,
  activeAlerts: 0,
  addedAt: '2026-10-01T00:00:00Z',
});

async function open(
  path = '/trade/spot/BTCUSDT',
  paperTrading?: PaperTradingService,
) {
  let live: ((value: MarketTicker) => void) | null = null;
  let overview: ((value: MarketOverview) => void) | null = null;
  const market: MarketService = {
    listPairs: vi.fn(async () => PAIRS),
    getCandles: vi.fn<MarketService['getCandles']>(
      async ({ before, limit }) => {
        const end = before ? (Date.parse(before) - START) / HOUR : 1000;
        return Array.from({ length: limit }, (_, i) =>
          candleAt(end - limit + i),
        );
      },
    ),
    getFuturesMetrics: vi.fn(),
    getTicker: vi.fn(async () => null),
  };
  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview: (_market, listener) => {
      overview = listener;
      return () => undefined;
    },
    subscribeKline: () => () => undefined,
    subscribeTicker: (_m, _s, listener) => {
      live = listener;
      return () => undefined;
    },
  };
  const watchlist: WatchlistService = {
    get: vi.fn(async () => ({ items: [watched('SOLUSDT')], limit: null })),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  await renderRoutes(
    [
      page('/trade/spot', <TradeSpotPage />),
      page('/trade/spot/:symbol', <TradeSpotPage />),
    ],
    path,
    fakeAuth({ restoreSession: async () => testTrader }),
    {
      market,
      marketFeed,
      watchlist,
      ...(paperTrading ? { paperTrading } : {}),
    },
  );
  return {
    market,
    pushTicker: (value: MarketTicker) => act(() => live?.(value)),
    pushOverview: (tickers: MarketTicker[]) =>
      act(() =>
        overview?.({
          market: 'spot',
          serverTime: new Date().toISOString(),
          tickers,
        }),
      ),
  };
}

describe('Spot demo trading layout (TR-F1, D-86)', () => {
  it('opens the first pair, says it is demo trading and that the account is not connected yet', async () => {
    await open('/trade/spot');
    expect(
      await screen.findByRole('button', {
        name: 'Choose a pair (current: BTC/USDT)',
      }),
    ).toBeTruthy();
    const note = screen.getByRole('note');
    expect(note.textContent).toContain(
      'Demo trading: virtual funds, not real trading.',
    );
    await waitFor(() =>
      expect(within(note).getByRole('status').textContent).toContain(
        'not connected to the server yet',
      ),
    );
    for (const region of [
      'Order book',
      'Market trades',
      'Spot order',
      'Orders and funds',
    ])
      expect(screen.getByRole('region', { name: region })).toBeTruthy();
  });

  it('reopens the pair last opened, and the first pair once that one is gone', async () => {
    await open('/trade/spot/SOLUSDT');
    await screen.findByRole('button', {
      name: 'Choose a pair (current: SOL/USDT)',
    });
    expect(window.localStorage.getItem('cp-trade-spot-pair')).toBe('SOLUSDT');
    cleanup();

    await open('/trade/spot');
    expect(
      await screen.findByRole('button', {
        name: 'Choose a pair (current: SOL/USDT)',
      }),
    ).toBeTruthy();
    cleanup();

    window.localStorage.setItem('cp-trade-spot-pair', 'DELISTEDUSDT');
    await open('/trade/spot');
    expect(
      await screen.findByRole('button', {
        name: 'Choose a pair (current: BTC/USDT)',
      }),
    ).toBeTruthy();
  });

  it('says the demo account is not connected in the form and the orders panel', async () => {
    await open();
    const form = await screen.findByRole('region', { name: 'Spot order' });
    await waitFor(() =>
      expect(form.textContent).toContain('not connected to the server yet'),
    );
    expect(
      within(form).getByRole('button', { name: 'Buy BTC' }),
    ).toHaveProperty('disabled', true);
    expect(form.textContent).not.toContain('Add this pair to your watchlist');
    const panel = screen.getByRole('region', { name: 'Orders and funds' });
    await waitFor(() =>
      expect(panel.textContent).toContain('not connected to the server yet'),
    );
  });

  it('opens the demo account once and says it is ready', async () => {
    const paperTrading: PaperTradingService = {
      ...createPendingPaperTradingService(),
      openAccount: vi.fn(async () => ({
        accountId: 'a-1',
        positionMode: 'one-way' as const,
        openedAt: '2026-10-13T00:00:00Z',
      })),
    };
    await open('/trade/spot/BTCUSDT', paperTrading);
    await waitFor(() =>
      expect(
        within(screen.getByRole('note')).getByRole('status').textContent,
      ).toBe('Demo account: Ready'),
    );
    expect(paperTrading.openAccount).toHaveBeenCalledTimes(1);
  });

  it('shows the 24h statistics with both volumes and the direction of the last tick', async () => {
    const { pushTicker } = await open();
    await screen.findByRole('region', { name: 'BTCUSDT' });
    pushTicker(ticker('BTCUSDT', '63000.01', '-1.254', '1139455120.42'));
    const region = screen.getByRole('region', { name: 'BTCUSDT' });
    await waitFor(() => expect(region.textContent).toContain('63,000.01'));
    expect(region.textContent).toContain('-1.25%');
    expect(region.textContent).toContain('63,950.00');
    expect(region.textContent).toContain('61,820.50');
    expect(region.textContent).toContain('24h volume (BTC)18.23K');
    expect(region.textContent).toContain('24h volume (USDT)1.14B');
    pushTicker(ticker('BTCUSDT', '63010.00', '-1.20', '1139455120.42'));
    expect(await within(region).findByRole('img', { name: 'up' })).toBeTruthy();
    pushTicker(ticker('BTCUSDT', '62990.00', '-1.30', '1139455120.42'));
    expect(
      await within(region).findByRole('img', { name: 'down' }),
    ).toBeTruthy();
  });

  it('finds, sorts and switches pairs from the selector', async () => {
    const { pushOverview } = await open();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Choose a pair (current: BTC/USDT)',
      }),
    );
    pushOverview([
      ticker('BTCUSDT', '63000.01', '-1.25', '1139455120.42'),
      ticker('ETHUSDT', '2500.10', '3.10', '500000000'),
      ticker('SOLUSDT', '150.20', '0.50', '90000000'),
    ]);
    const list = screen.getByRole('listbox', { name: 'Spot pairs' });
    const names = () =>
      within(list)
        .getAllByRole('option')
        .map((option) => option.textContent?.slice(0, 8));
    expect(names()).toEqual(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
    await user.click(
      screen.getByRole('button', { name: 'Sort by 24h change' }),
    );
    expect(names()).toEqual(['ETH/USDT', 'SOL/USDT', 'BTC/USDT']);

    await user.click(screen.getByRole('radio', { name: 'Favorites' }));
    expect(names()).toEqual(['SOL/USDT']);
    await user.click(screen.getByRole('radio', { name: 'USDT' }));

    await user.type(
      screen.getByRole('combobox', { name: 'Search pairs' }),
      'ethereum',
    );
    expect(names()).toEqual(['ETH/USDT']);
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('button', {
        name: 'Choose a pair (current: ETH/USDT)',
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the selector with Escape and says when nothing matches', async () => {
    await open();
    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', {
      name: 'Choose a pair (current: BTC/USDT)',
    });
    await user.click(trigger);
    await user.type(
      screen.getByRole('combobox', { name: 'Search pairs' }),
      'zzz',
    );
    expect(screen.getByText('No results found.')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('points to another pair when the symbol is not an enabled Spot pair', async () => {
    await open('/trade/spot/XYZUSDT');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This pair is not available on Spot.');
    expect(
      within(alert)
        .getByRole('link', { name: 'BTC/USDT' })
        .getAttribute('href'),
    ).toBe('/trade/spot/BTCUSDT');
  });

  it('remembers the timeframe on the device for every pair', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(await screen.findByRole('radio', { name: '4h' }));
    expect(window.localStorage.getItem('cp-trade-timeframe')).toBe('4h');
    cleanup();
    await open('/trade/spot/ETHUSDT');
    expect(
      (await screen.findByRole('radio', { name: '4h' })).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
  });

  it('opens on the latest bars and reads older candles at the start, keeping the view', async () => {
    const { market } = await open();
    await screen.findByRole('img', { name: /BTCUSDT 1h candlestick chart/ });
    expect(view.set[0]).toEqual({ from: 850, to: 1005 });
    // The Trader drags the chart to its start.
    act(() => {
      view.range = { from: 10, to: 160 };
      view.onRange?.(view.range);
    });
    await waitFor(() =>
      expect(market.getCandles).toHaveBeenLastCalledWith(
        expect.objectContaining({
          limit: 500,
          before: candleAt(0).openTime,
        }),
      ),
    );
    await waitFor(() => expect(view.bars).toBe(1500));
    // 500 bars went in front: the same candles stay in view.
    expect(view.set.at(-1)).toEqual({ from: 510, to: 660 });
  });

  it('keeps Tab inside the pair list', async () => {
    await open();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Choose a pair (current: BTC/USDT)',
      }),
    );
    const panel = screen.getByRole('dialog', { name: 'Spot pairs' });
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(panel.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(panel.contains(document.activeElement)).toBe(true);
  });
});
