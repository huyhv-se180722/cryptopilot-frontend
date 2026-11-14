// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDevelopmentChartDrawings } from '../../../dev/dev-chart-drawings';
import type { ChartDrawingService } from '../../../services/api/chart-drawings';
import type {
  MarketFeed,
  MarketService,
} from '../../../services/api/contracts';
import type { Candle } from '../../../types/domain';
import { fakeAuth, page, renderRoutes } from '../../../test/render';
import { AnalysisChart } from '../components/AnalysisChart';
import type { DrawingPrimitive } from './drawing-primitive';

/**
 * The chart library, with linear scales: bar i at x = 4i, price p at
 * y = (110 - p) × 20, a 800 × 320 price pane.
 */
const chart = vi.hoisted(() => ({
  primitives: [] as unknown[],
  options: [] as Record<string, unknown>[],
}));
vi.mock('lightweight-charts', () => {
  const kind = (name: string) => ({ name });
  return {
    CandlestickSeries: kind('candles'),
    LineSeries: kind('line'),
    HistogramSeries: kind('histogram'),
    ColorType: { Solid: 'solid' },
    createSeriesMarkers: () => ({ setMarkers: () => undefined }),
    createChart: () => ({
      addSeries: () => ({
        setData: () => undefined,
        update: () => undefined,
        createPriceLine: (options: object) =>
          Object.assign(options, { applyOptions: () => undefined }),
        removePriceLine: () => undefined,
        priceScale: () => ({ applyOptions: () => undefined }),
        priceToCoordinate: (price: number) => (110 - price) * 20,
        coordinateToPrice: (y: number) => 110 - y / 20,
        attachPrimitive: (primitive: { attached?: (p: object) => void }) => {
          chart.primitives.push(primitive);
          primitive.attached?.({ requestUpdate: () => undefined });
        },
        detachPrimitive: (primitive: unknown) => {
          chart.primitives.splice(chart.primitives.indexOf(primitive), 1);
        },
      }),
      panes: () =>
        [0, 1, 2, 3].map(() => ({
          setStretchFactor: () => undefined,
          getHeight: () => 320,
        })),
      timeScale: () => ({
        fitContent: () => undefined,
        width: () => 800,
        logicalToCoordinate: (logical: number) => logical * 4,
        coordinateToLogical: (x: number) => x / 4,
      }),
      applyOptions: (options: Record<string, unknown>) => {
        chart.options.push(options);
      },
      remove: () => undefined,
    }),
  };
});

const HOUR = 3_600_000;
const START = Date.UTC(2026, 9, 1);
const candles: Candle[] = Array.from({ length: 120 }, (_, i) => ({
  openTime: new Date(START + i * HOUR).toISOString(),
  open: '100',
  high: '106',
  low: '98',
  close: '102',
  baseVolume: '10',
  quoteVolume: '1000',
}));
const time = (bar: number) => new Date(START + bar * HOUR).toISOString();

const market = {
  listPairs: vi.fn(async () => []),
  getCandles: vi.fn(async () => candles),
  getFuturesMetrics: vi.fn(),
  getTicker: vi.fn(async () => null),
} as unknown as MarketService;
const marketFeed: MarketFeed = {
  status: () => 'open',
  onStatus: () => () => undefined,
  subscribeOverview: () => () => undefined,
  subscribeTicker: () => () => undefined,
  subscribeKline: () => () => undefined,
};

async function render(chartDrawings: ChartDrawingService) {
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
          drawingPairId="pair-1"
        />,
      ),
    ],
    '/chart',
    fakeAuth(),
    { market, marketFeed, chartDrawings },
  );
  await screen.findByRole('toolbar', { name: 'Drawing tools' });
  return screen.getByRole('img', { name: /candlestick chart/ });
}

/** A press and release on the price pane at bar `bar` and price `price`. */
function click(pane: HTMLElement, bar: number, price: number) {
  const at = { clientX: bar * 4, clientY: (110 - price) * 20, button: 0 };
  fireEvent.pointerDown(pane, at);
  fireEvent.pointerUp(window, at);
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(() => {
  window.localStorage.clear();
  chart.primitives.length = 0;
  chart.options.length = 0;
});

describe('drawing on the chart (D-149, T-120, T-121)', () => {
  it('shows no tools while the drawings cannot be loaded', async () => {
    const failing = {
      ...createDevelopmentChartDrawings(),
      list: vi.fn(async () => {
        throw new Error('down');
      }),
    };
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
            drawingPairId="pair-1"
          />,
        ),
      ],
      '/chart',
      fakeAuth(),
      { market, marketFeed, chartDrawings: failing },
    );
    await screen.findByRole('img', { name: /candlestick chart/ });
    expect(screen.queryByRole('toolbar', { name: 'Drawing tools' })).toBeNull();
    expect(chart.primitives).toHaveLength(0);
  });

  it('draws a trend line in two clicks, saves it, and undoes and redoes it', async () => {
    const service = createDevelopmentChartDrawings();
    const pane = await render(service);
    await waitFor(() => expect(chart.primitives).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: 'Trend line' }));
    expect(chart.options.at(-1)).toEqual({
      handleScroll: false,
      handleScale: false,
    });
    click(pane, 10, 105);
    fireEvent.pointerMove(pane, { clientX: 80, clientY: 150 });
    click(pane, 30, 100);

    await waitFor(async () =>
      expect(await service.list('pair-1')).toHaveLength(1),
    );
    const [line] = await service.list('pair-1');
    expect(line).toMatchObject({
      type: 'TREND_LINE',
      points: [
        { time: time(10), price: '105.00' },
        { time: time(30), price: '100.00' },
      ],
    });
    // The tool is put down and the chart pans again.
    expect(
      screen
        .getByRole('button', { name: 'Trend line' })
        .getAttribute('aria-pressed'),
    ).toBe('false');

    const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z)' });
    await waitFor(() => expect(undo.hasAttribute('disabled')).toBe(false));
    await userEvent.click(undo);
    await waitFor(async () =>
      expect(await service.list('pair-1')).toHaveLength(0),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Redo (Ctrl+Y)' }),
    );
    await waitFor(async () =>
      expect(await service.list('pair-1')).toHaveLength(1),
    );
  });

  it('selects a drawing, restyles, locks and removes it from the floating bar', async () => {
    const service = createDevelopmentChartDrawings();
    await service.create({
      pairId: 'pair-1',
      type: 'HORIZONTAL_LINE',
      points: [{ time: time(20), price: '104' }],
      style: {
        lineColor: '#2962FF',
        lineWidth: 2,
        lineStyle: 'SOLID',
        fillColor: null,
        extendLeft: false,
        extendRight: false,
        fontSize: null,
        fibLevels: null,
      },
      text: null,
      locked: false,
      hidden: false,
    });
    const pane = await render(service);
    await waitFor(() => expect(chart.primitives).toHaveLength(1));

    click(pane, 50, 104);
    const bar = await screen.findByRole('toolbar', {
      name: 'Selected drawing',
    });
    expect(bar).toBeTruthy();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Line width' }),
      '4',
    );
    await waitFor(async () =>
      expect((await service.list('pair-1'))[0]?.style.lineWidth).toBe(4),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Colour' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Colour #EF5350' }),
    );
    await waitFor(async () =>
      expect((await service.list('pair-1'))[0]?.style.lineColor).toBe(
        '#EF5350',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await waitFor(async () =>
      expect((await service.list('pair-1'))[0]?.locked).toBe(true),
    );
    expect(
      screen.getByRole('button', { name: 'Remove' }).hasAttribute('disabled'),
    ).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(async () =>
      expect(await service.list('pair-1')).toHaveLength(0),
    );
    expect(
      screen.queryByRole('toolbar', { name: 'Selected drawing' }),
    ).toBeNull();
  });

  it('sets exact prices in the settings, and asks before removing every drawing', async () => {
    const service = createDevelopmentChartDrawings();
    await service.create({
      pairId: 'pair-1',
      type: 'LONG_POSITION',
      points: [
        { time: time(20), price: '102' },
        { time: time(40), price: '100' },
        { time: time(40), price: '106' },
      ],
      style: {
        lineColor: '#2962FF',
        lineWidth: 2,
        lineStyle: 'SOLID',
        fillColor: null,
        extendLeft: false,
        extendRight: false,
        fontSize: null,
        fibLevels: null,
      },
      text: null,
      locked: false,
      hidden: false,
    });
    const pane = await render(service);
    await waitFor(() => expect(chart.primitives).toHaveLength(1));
    click(pane, 30, 104);
    await screen.findByRole('toolbar', { name: 'Selected drawing' });
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const stop = await screen.findByLabelText('Stop price');
    await userEvent.clear(stop);
    await userEvent.type(stop, '103');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /sides of the entry/,
    );
    await userEvent.clear(stop);
    await userEvent.type(stop, '99.5');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () =>
      expect((await service.list('pair-1'))[0]?.points[1]?.price).toBe('99.5'),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove all drawings' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove all' }),
    );
    await waitFor(async () =>
      expect(await service.list('pair-1')).toHaveLength(0),
    );
  });

  it('adds a text drawing once its text is written', async () => {
    const service = createDevelopmentChartDrawings();
    const pane = await render(service);
    await waitFor(() => expect(chart.primitives).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Text' }));
    click(pane, 15, 101);
    const box = await screen.findByPlaceholderText('Your note');
    await userEvent.type(box, 'FOMC tonight');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(async () =>
      expect((await service.list('pair-1'))[0]).toMatchObject({
        type: 'TEXT',
        text: 'FOMC tonight',
      }),
    );
  });

  it('opens a group menu and keeps the magnet and hide options on the device', async () => {
    const service = createDevelopmentChartDrawings();
    await render(service);
    await userEvent.click(
      screen.getByRole('button', { name: 'More Lines tools' }),
    );
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'Horizontal ray' }),
    );
    expect(
      screen
        .getByRole('button', { name: 'Horizontal ray' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: /Magnet/ }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Hide all drawings' }),
    );
    expect(
      JSON.parse(window.localStorage.getItem('cp-drawing-options') ?? '{}'),
    ).toMatchObject({
      magnet: true,
      hideAll: true,
    });
  });

  it('paints the drawings and the one being placed through the primitive', async () => {
    const service = createDevelopmentChartDrawings();
    const pane = await render(service);
    await waitFor(() => expect(chart.primitives).toHaveLength(1));
    await userEvent.click(
      screen.getByRole('button', { name: 'Long position' }),
    );
    click(pane, 10, 102);
    await waitFor(async () =>
      expect(await service.list('pair-1')).toHaveLength(1),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const context = new Proxy(
      { measureText: () => ({ width: 40 }) },
      {
        get: (target, name) =>
          name in target ? target[name as 'measureText'] : () => undefined,
        set: () => true,
      },
    );
    const primitive = chart.primitives[0] as DrawingPrimitive;
    const draw = () =>
      primitive
        .paneViews()[0]!
        .renderer()!
        .draw({
          useMediaCoordinateSpace: (
            paint: (scope: { context: unknown }) => void,
          ) => paint({ context }),
        } as never);
    expect(draw).not.toThrow();
  });
});
