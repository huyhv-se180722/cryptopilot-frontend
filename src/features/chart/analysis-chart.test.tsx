// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpotAnalysisPage } from '../../pages/trader/SpotAnalysisPage';
import type { MarketFeed, MarketService } from '../../services/api/contracts';
import type { Candle, KlineUpdate } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';

/** Records what the page asks the chart library to draw. */
const drawn = vi.hoisted(() => ({
  series: [] as { kind: string; pane: number; data: unknown[] }[],
}));
vi.mock('lightweight-charts', () => {
  const kind = (name: string) => ({ name });
  return {
    CandlestickSeries: kind('candles'),
    LineSeries: kind('line'),
    HistogramSeries: kind('histogram'),
    ColorType: { Solid: 'solid' },
    createChart: () => {
      const own: typeof drawn.series = [];
      return {
        addSeries: (
          definition: { name: string },
          _options: unknown,
          pane = 0,
        ) => {
          const entry = { kind: definition.name, pane, data: [] as unknown[] };
          own.push(entry);
          drawn.series.push(entry);
          return {
            setData: (data: unknown[]) => {
              entry.data = data;
            },
            createPriceLine: vi.fn(),
          };
        },
        panes: () => [0, 1, 2, 3].map(() => ({ setStretchFactor: vi.fn() })),
        timeScale: () => ({ fitContent: vi.fn() }),
        remove: () => {
          own.forEach((entry) => {
            const at = drawn.series.indexOf(entry);
            if (at >= 0) drawn.series.splice(at, 1);
          });
        },
      };
    },
  };
});

const HOUR = 3_600_000;
const candles = (count: number): Candle[] =>
  Array.from({ length: count }, (_, i) => ({
    openTime: new Date(Date.UTC(2026, 9, 1) + i * HOUR).toISOString(),
    open: '100',
    high: '102',
    low: '99',
    close: String(100 + (i % 5)),
    baseVolume: '10',
    quoteVolume: '1000',
  }));

function render(path = '/markets/spot/BTCUSDT', count = 260) {
  let kline: ((update: KlineUpdate) => void) | null = null;
  const market: MarketService = {
    listPairs: vi.fn(async () => [
      {
        symbol: 'BTCUSDT',
        market: 'spot' as const,
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        baseAssetName: 'Bitcoin',
        logoUrl: null,
        tickSize: '0.01',
        displayOrder: 1,
      },
    ]),
    getCandles: vi.fn(async () => candles(count)),
    getTicker: vi.fn(),
  };
  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview: () => () => undefined,
    subscribeKline: (_m, _s, _t, listener) => {
      kline = listener;
      return () => undefined;
    },
  };
  const ready = renderRoutes(
    [page('/markets/spot/:symbol', <SpotAnalysisPage />)],
    path,
    fakeAuth(),
    { market, marketFeed },
  );
  const push = (update: KlineUpdate) => act(() => kline?.(update));
  return { ready, market, push };
}

afterEach(() => {
  window.localStorage.clear();
  drawn.series.length = 0;
});

describe('SCR-10 analysis chart (T-032)', () => {
  it('draws candles, the five overlays and the three panels by default', async () => {
    const { ready, market } = render();
    await ready;
    await screen.findByRole('img', {
      name: 'BTCUSDT 1h candlestick chart with the latest 260 closed candles',
    });
    expect(market.getCandles).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: '1h', limit: 1000 }),
    );
    const kinds = drawn.series.map((s) => `${s.kind}@${s.pane}`);
    // Candles + SMA20 + EMA20/50/200 + three Bollinger lines on the price pane.
    expect(kinds.filter((k) => k.endsWith('@0'))).toHaveLength(8);
    expect(kinds.filter((k) => k.endsWith('@1'))).toEqual([
      'histogram@1',
      'line@1',
    ]);
    expect(kinds.filter((k) => k.endsWith('@2'))).toEqual(['line@2']);
    expect(kinds.filter((k) => k.endsWith('@3'))).toEqual([
      'histogram@3',
      'line@3',
      'line@3',
    ]);
  });

  it('hides an item, remembers it, and reads another timeframe', async () => {
    const { ready, market } = render();
    await ready;
    await screen.findByRole('img');
    const before = drawn.series.length;
    await userEvent.click(
      screen.getByRole('button', { name: 'MACD 12, 26, 9' }),
    );
    expect(drawn.series.length).toBe(before - 3);
    expect(window.localStorage.getItem('cp-chart-items')).toContain(
      '"macd":false',
    );
    await userEvent.click(screen.getByRole('radio', { name: '4h' }));
    await waitFor(() =>
      expect(market.getCandles).toHaveBeenLastCalledWith(
        expect.objectContaining({ timeframe: '4h' }),
      ),
    );
  });

  it('draws the forming candle faded after the closed ones', async () => {
    const { ready, push } = render();
    await ready;
    await screen.findByRole('img');
    push({
      market: 'spot',
      symbol: 'BTCUSDT',
      timeframe: '1h',
      closed: false,
      candle: { ...candles(261)[260]!, close: '104' },
    });
    expect(await screen.findByText('Forming candle, provisional')).toBeTruthy();
    const bars = drawn.series.find((s) => s.kind === 'candles')?.data as {
      color?: string;
    }[];
    await waitFor(() => expect(bars?.length ?? 0).toBeGreaterThan(0));
    const latest = drawn.series.find((s) => s.kind === 'candles')?.data as {
      color?: string;
    }[];
    expect(latest).toHaveLength(261);
    expect(latest[260]).toHaveProperty('color');
    expect(latest[259]).not.toHaveProperty('color');
  });

  it('says when EMA 200 lacks history (insufficient data)', async () => {
    const first = render('/markets/spot/BTCUSDT', 120);
    await first.ready;
    expect(
      await screen.findByText(/Fewer than 200 closed candles/),
    ).toBeTruthy();
  });

  it('shows that an unknown pair is not available', async () => {
    const { ready } = render('/markets/spot/XYZUSDT');
    await ready;
    expect((await screen.findByRole('alert')).textContent).toContain(
      'This pair is not available on Spot.',
    );
  });
});
