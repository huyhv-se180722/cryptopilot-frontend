// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SpotAnalysisPage } from '../../pages/trader/SpotAnalysisPage';
import type { MarketFeed, MarketService } from '../../services/api/contracts';
import type { Candle, KlineUpdate } from '../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../test/render';
import { AnalysisChart, type ChartPriceLine } from './components/AnalysisChart';

/** Records what the page asks the chart library to draw. */
const drawn = vi.hoisted(() => ({
  series: [] as { kind: string; pane: number; data: unknown[] }[],
  charts: 0,
  lines: [] as { price: number; title: string; lineStyle: number }[],
}));
vi.mock('lightweight-charts', () => {
  const kind = (name: string) => ({ name });
  return {
    CandlestickSeries: kind('candles'),
    LineSeries: kind('line'),
    HistogramSeries: kind('histogram'),
    ColorType: { Solid: 'solid' },
    createChart: () => {
      drawn.charts += 1;
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
            // Price-pane lines only; RSI 30 / 70 sit on their own pane.
            createPriceLine: (options: (typeof drawn.lines)[number]) => {
              if (definition.name === 'candles') drawn.lines.push(options);
              return options;
            },
            removePriceLine: (line: (typeof drawn.lines)[number]) => {
              const at = drawn.lines.indexOf(line);
              if (at >= 0) drawn.lines.splice(at, 1);
            },
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

const fakeMarket = (count: number): MarketService => ({
  listPairs: vi.fn(async () => [
    {
      symbol: 'BTCUSDT',
      market: 'spot' as const,
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      baseAssetName: 'Bitcoin',
      logoUrl: null,
      tickSize: '0.01',
      stepSize: '0.00001',
      minNotional: '5',
      displayOrder: 1,
    },
  ]),
  getCandles: vi.fn(async () => candles(count)),
  getFuturesMetrics: vi.fn(),
  getTicker: vi.fn(),
});

function render(path = '/markets/spot/BTCUSDT', count = 260) {
  const klines = new Set<(update: KlineUpdate) => void>();
  const market = fakeMarket(count);
  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview: () => () => undefined,
    subscribeTicker: () => () => undefined,
    subscribeKline: (_m, _s, _t, listener) => {
      klines.add(listener);
      return () => klines.delete(listener);
    },
  };
  const ready = renderRoutes(
    [page('/markets/spot/:symbol', <SpotAnalysisPage />)],
    path,
    fakeAuth(),
    { market, marketFeed },
  );
  const push = (update: KlineUpdate) =>
    act(() => klines.forEach((listener) => listener(update)));
  return { ready, market, push };
}

afterEach(() => {
  window.localStorage.clear();
  drawn.series.length = 0;
  drawn.lines.length = 0;
  drawn.charts = 0;
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

  it('draws price lines and redraws them without rebuilding the chart', async () => {
    const order: ChartPriceLine = {
      id: 'order-1',
      price: '62000.00',
      label: 'Buy 0.01',
      tone: 'positive',
    };
    function Harness() {
      const [lines, setLines] = useState<readonly ChartPriceLine[]>([order]);
      return (
        <>
          <button
            type="button"
            onClick={() =>
              setLines([{ ...order, price: '62500.00', dashed: false }])
            }
          >
            move
          </button>
          <AnalysisChart
            market="spot"
            symbol="BTCUSDT"
            tickSize="0.01"
            timeframe="1h"
            onTimeframeChange={() => undefined}
            levels={{ support: '61000.00', resistance: null }}
            priceLines={lines}
          />
        </>
      );
    }
    await renderRoutes([page('/chart', <Harness />)], '/chart', fakeAuth(), {
      market: fakeMarket(260),
    });
    await screen.findByRole('img');
    await waitFor(() =>
      expect(drawn.lines.map((line) => [line.title, line.price])).toEqual([
        ['Support', 61000],
        ['Buy 0.01', 62000],
      ]),
    );
    const charts = drawn.charts;
    await userEvent.click(screen.getByRole('button', { name: 'move' }));
    await waitFor(() =>
      expect(drawn.lines.map((line) => line.price)).toEqual([61000, 62500]),
    );
    expect(drawn.lines[1]?.lineStyle).toBe(0);
    expect(drawn.charts).toBe(charts);
  });
});
