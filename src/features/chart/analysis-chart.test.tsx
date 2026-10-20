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
import { chartOffsetSeconds, zoneLabel } from './components/chart-time';

/** An hourly chart is drawn in local time, shifted by this from UTC. */
const LOCAL = chartOffsetSeconds('1h');

/** Records what the page asks the chart library to draw. */
const drawn = vi.hoisted(() => ({
  series: [] as {
    kind: string;
    pane: number;
    data: unknown[];
    writes: number;
    updates: unknown[];
  }[],
  charts: 0,
  lines: [] as {
    price: number;
    title: string;
    lineStyle: number;
    axisLabelVisible?: boolean;
  }[],
  markers: [] as { time: number; shape: string; text?: string }[],
  locales: [] as (string | undefined)[],
}));
vi.mock('lightweight-charts', () => {
  const kind = (name: string) => ({ name });
  return {
    CandlestickSeries: kind('candles'),
    LineSeries: kind('line'),
    HistogramSeries: kind('histogram'),
    ColorType: { Solid: 'solid' },
    createSeriesMarkers: () => ({
      setMarkers: (markers: typeof drawn.markers) => {
        drawn.markers = markers;
      },
    }),
    createChart: (
      _container: unknown,
      options?: { localization?: { locale?: string } },
    ) => {
      drawn.charts += 1;
      drawn.locales.push(options?.localization?.locale);
      const own: typeof drawn.series = [];
      return {
        addSeries: (
          definition: { name: string },
          _options: unknown,
          pane = 0,
        ) => {
          const entry = {
            kind: definition.name,
            pane,
            data: [] as unknown[],
            writes: 0,
            updates: [] as unknown[],
          };
          own.push(entry);
          drawn.series.push(entry);
          return {
            setData: (data: unknown[]) => {
              entry.data = data;
              entry.writes += 1;
            },
            update: (bar: unknown) => {
              entry.updates.push(bar);
            },
            // Price-pane lines only; RSI 30 / 70 sit on their own pane.
            createPriceLine: (options: (typeof drawn.lines)[number]) => {
              if (definition.name === 'candles') drawn.lines.push(options);
              return Object.assign(options, {
                applyOptions: (next: Partial<typeof options>) =>
                  Object.assign(options, next),
              });
            },
            removePriceLine: (line: (typeof drawn.lines)[number]) => {
              const at = drawn.lines.indexOf(line);
              if (at >= 0) drawn.lines.splice(at, 1);
            },
            // 1 px per price unit from 62,100 down, so 62,000 sits at y 100.
            priceScale: () => ({ applyOptions: vi.fn() }),
            priceToCoordinate: (price: number) => 62_100 - price,
          };
        },
        panes: () =>
          [0, 1, 2, 3].map(() => ({
            setStretchFactor: vi.fn(),
            getHeight: () => 320,
          })),
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
      pairId: '0199a0f0-1111-7aaa-8bbb-000000000001',
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
  getTicker: vi.fn(async () => null),
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
  drawn.markers = [];
  drawn.charts = 0;
  drawn.locales.length = 0;
  vi.restoreAllMocks();
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

  it('draws the forming candle faded, updating that bar alone as it moves', async () => {
    const { ready, push } = render();
    await ready;
    await screen.findByRole('img');
    const forming = candles(261)[260]!;
    const kline = (close: string, closed: boolean) =>
      push({
        market: 'spot',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        closed,
        candle: { ...forming, close },
      });
    const series = () => drawn.series.find((s) => s.kind === 'candles')!;
    const lines = () => drawn.series.filter((s) => s.kind !== 'candles');
    const writes = () => lines().map((s) => s.writes);

    const before = { candles: series().writes, lines: writes() };
    kline('104', false);
    expect(await screen.findByText('Forming candle, provisional')).toBeTruthy();
    // Added after the 260 closed ones as one faded bar, nothing rewritten.
    await waitFor(() => expect(series().updates).toHaveLength(1));
    expect(series().updates[0]).toHaveProperty('color');
    expect(series().data).toHaveLength(260);

    // It moves: that bar is updated again; no series is written, and the
    // indicators (drawn from closed candles) stay as they were.
    kline('105', false);
    kline('103', false);
    await waitFor(() => expect(series().updates).toHaveLength(3));
    expect(series().updates[2]).toMatchObject({
      time: Date.parse(forming.openTime) / 1000 + LOCAL,
      close: 103,
      color: expect.any(String),
    });
    expect(series().writes).toBe(before.candles);
    expect(writes()).toEqual(before.lines);

    // It closes: the closed list changed, so every series is written.
    kline('103', true);
    await waitFor(() => expect(series().writes).toBe(before.candles + 1));
    expect(series().data).toHaveLength(261);
    expect(series().data[260]).not.toHaveProperty('color');
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

  it('draws intraday candles in local time and daily ones in UTC, and says which', async () => {
    const { ready } = render();
    await ready;
    await screen.findByRole('img');
    const first = () =>
      (
        drawn.series.find((s) => s.kind === 'candles')?.data as {
          time: number;
        }[]
      )[0]?.time;
    const start = Date.UTC(2026, 9, 1) / 1000;
    expect(first()).toBe(start + LOCAL);
    expect(screen.getByText('Times in ' + zoneLabel(LOCAL))).toBeTruthy();

    await userEvent.click(screen.getByRole('radio', { name: '1d' }));
    await waitFor(() => expect(first()).toBe(start));
    expect(screen.getByText('Times in UTC')).toBeTruthy();
  });

  it('names months in the interface language, never the browser one', async () => {
    // Left alone, the chart library takes the browser's language: a
    // Vietnamese browser wrote "Tháng 8" on the axis among English copy.
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('vi-VN');
    const { ready } = render();
    await ready;
    await screen.findByRole('img');
    expect(drawn.locales.length).toBeGreaterThan(0);
    expect(new Set(drawn.locales)).toEqual(new Set(['en']));
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

  it('lets a level label give way beside the last price (BR-14)', async () => {
    // The last closed candle closes at 104; the mock puts y at 62,100 − price.
    await renderRoutes(
      [
        page(
          '/chart',
          <AnalysisChart
            market="spot"
            symbol="BTCUSDT"
            tickSize="0.01"
            timeframe="1h"
            onTimeframeChange={() => undefined}
            levels={{ support: '103.50', resistance: '200.00' }}
          />,
        ),
      ],
      '/chart',
      fakeAuth(),
      { market: fakeMarket(260) },
    );
    await screen.findByRole('img');
    await waitFor(() => {
      const support = drawn.lines.find((line) => line.price === 103.5);
      expect(support).toMatchObject({ axisLabelVisible: false, title: '' });
    });
    expect(drawn.lines.find((line) => line.price === 200)).toMatchObject({
      axisLabelVisible: true,
      title: 'Resistance',
    });
  });

  it('puts a line action at its price, and markers on the bar of their time', async () => {
    const cancel = vi.fn();
    const onToggle = vi.fn();
    const start = Date.UTC(2026, 9, 1);
    await renderRoutes(
      [
        page(
          '/chart',
          <AnalysisChart
            market="spot"
            symbol="BTCUSDT"
            tickSize="0.01"
            timeframe="1h"
            onTimeframeChange={() => undefined}
            priceLines={[
              {
                id: 'order-1',
                price: '62000.00',
                label: 'Buy 0.01',
                tone: 'positive',
                action: { label: 'Cancel order 1', onSelect: cancel },
              },
              // Above the pane (y < 0): no button.
              {
                id: 'order-2',
                price: '70000.00',
                label: 'Sell 0.01',
                tone: 'negative',
                action: { label: 'Cancel order 2', onSelect: cancel },
              },
            ]}
            markers={[
              // 30 minutes into the third bar, then before the first bar.
              {
                id: 'fill-1',
                time: new Date(start + 2.5 * HOUR).toISOString(),
                direction: 'down',
                tone: 'negative',
              },
              {
                id: 'fill-0',
                time: new Date(start - HOUR).toISOString(),
                direction: 'up',
                tone: 'positive',
              },
              {
                id: 'fill-2',
                time: new Date(start + HOUR).toISOString(),
                direction: 'up',
                tone: 'positive',
                text: 'B',
              },
            ]}
            extraItems={[
              { id: 'orders', label: 'Orders', pressed: true, onToggle },
            ]}
          />,
        ),
      ],
      '/chart',
      fakeAuth(),
      { market: fakeMarket(260) },
    );
    const button = await screen.findByRole('button', {
      name: 'Cancel order 1',
    });
    // The label moves from the axis into the chip that holds the button.
    expect(button.parentElement?.style.top).toBe('100px');
    expect(button.parentElement?.textContent).toBe('Buy 0.01');
    expect(drawn.lines.find((line) => line.price === 62000)?.title).toBe('');
    expect(screen.queryByRole('button', { name: 'Cancel order 2' })).toBeNull();
    await userEvent.click(button);
    expect(cancel).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(drawn.markers).toHaveLength(2));
    expect(drawn.markers).toEqual([
      expect.objectContaining({
        time: (start + HOUR) / 1000 + LOCAL,
        shape: 'arrowUp',
        text: 'B',
      }),
      expect.objectContaining({
        time: (start + 2 * HOUR) / 1000 + LOCAL,
        shape: 'arrowDown',
      }),
    ]);

    const toggle = screen.getByRole('button', { name: 'Orders' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
