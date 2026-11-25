// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { ChartDrawing, DrawingPoint } from '../../../../types/domain';
import type { Projection } from '../controller';
import { DEFAULT_STYLE } from '../tools';
import { MobileDrawingLayer, type LayerEvent } from './mobile-layer';

const T0 = Date.parse('2026-11-01T00:00:00Z');
const HOUR = 3_600_000;

// One hour is 10 px; a price is 1000 - y.
const projection: Projection = {
  context: {
    width: 800,
    height: 400,
    y: (price) => 1000 - price,
    price: (price) => price.toFixed(0),
    bars: (from, to) => (to - from) / 3600,
    labels: {
      target: '{price}',
      stop: '{price}',
      ratio: '{ratio}',
      span: '{bars}',
      leftShoulder: 'LS',
      head: 'H',
      rightShoulder: 'RS',
    },
  },
  pixel: (point) => ({
    x: ((Date.parse(point.time) - T0) / HOUR) * 10,
    y: 1000 - Number(point.price),
  }),
  point: (at) => ({
    time: new Date(T0 + Math.round(at.x / 10) * HOUR).toISOString(),
    price: String(Math.round(1000 - at.y)),
  }),
  later: (point, bars) => ({
    time: new Date(Date.parse(point.time) + bars * HOUR).toISOString(),
    price: point.price,
  }),
  scale: (price, factor) => String(Math.round(Number(price) * (1 + factor))),
};

vi.mock('../projection', () => ({ chartProjection: () => projection }));

const point = (hour: number, price: number): DrawingPoint => ({
  time: new Date(T0 + hour * HOUR).toISOString(),
  price: String(price),
});

function line(id: string, a: DrawingPoint, b: DrawingPoint): ChartDrawing {
  return {
    id,
    layoutId: 'layout-1',
    type: 'TREND_LINE',
    points: [a, b],
    style: DEFAULT_STYLE,
    text: null,
    locked: false,
    hidden: false,
    version: 0,
  };
}

function pointer(
  type: string,
  x: number,
  y: number,
  extra: { pointerId?: number; isPrimary?: boolean } = {},
): Event {
  const event = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'pointerId', { value: extra.pointerId ?? 1 });
  Object.defineProperty(event, 'isPrimary', {
    value: extra.isPrimary ?? true,
  });
  return event;
}

let events: LayerEvent[];
let options: ReturnType<typeof vi.fn>;
let crosshair: ReturnType<typeof vi.fn>;
let container: HTMLElement;
let layer: MobileDrawingLayer;

function tap(x: number, y: number) {
  container.dispatchEvent(pointer('pointerdown', x, y));
  container.dispatchEvent(pointer('pointerup', x, y));
}

beforeEach(() => {
  events = [];
  options = vi.fn();
  crosshair = vi.fn();
  container = document.createElement('div');
  const chart = {
    applyOptions: options,
    panes: () => [{ getHeight: () => 400 }],
    timeScale: () => ({ width: () => 800, coordinateToTime: () => 1 }),
    setCrosshairPosition: crosshair,
    clearCrosshairPosition: vi.fn(),
  } as unknown as IChartApi;
  const series = {
    attachPrimitive: vi.fn(),
    detachPrimitive: vi.fn(),
    coordinateToPrice: () => 900,
  } as unknown as ISeriesApi<'Candlestick'>;
  layer = new MobileDrawingLayer(chart, series, container, (event) =>
    events.push(event),
  );
  layer.setBars({ bars: [], barSeconds: 3600, offset: 0, places: 0 });
});

const frozen = () => options.mock.lastCall?.[0]?.handleScale === false;

describe('MobileDrawingLayer', () => {
  it('only paints until it is made editable', () => {
    layer.setDrawings([line('d1', point(10, 900), point(30, 900))]);
    layer.setTool('trendLine');
    tap(200, 100);
    expect(events).toEqual([]);
    expect(options).not.toHaveBeenCalled();
  });

  it('places a trend line anchor by anchor where the finger lifts', () => {
    layer.setEditable(true);
    layer.setTool('trendLine');
    expect(frozen()).toBe(true);
    tap(100, 100);
    container.dispatchEvent(pointer('pointerdown', 150, 150));
    container.dispatchEvent(pointer('pointermove', 180, 160));
    expect(crosshair).toHaveBeenCalled();
    container.dispatchEvent(pointer('pointerup', 200, 200));
    const created = events.find((event) => event.type === 'drawing.create');
    expect(created).toMatchObject({
      draft: { type: 'TREND_LINE', points: [point(10, 900), point(20, 800)] },
    });
    expect(events).toContainEqual({ type: 'drawing.toolDone' });
    expect(frozen()).toBe(false);
  });

  it('draws a trend line in one drag, from where it went down to the lift', () => {
    layer.setEditable(true);
    layer.setTool('trendLine');
    container.dispatchEvent(pointer('pointerdown', 100, 100));
    container.dispatchEvent(pointer('pointermove', 150, 150));
    container.dispatchEvent(pointer('pointermove', 200, 200));
    container.dispatchEvent(pointer('pointerup', 200, 200));
    expect(
      events.filter((event) => event.type === 'drawing.create'),
    ).toMatchObject([
      {
        draft: { type: 'TREND_LINE', points: [point(10, 900), point(20, 800)] },
      },
    ]);
  });

  it('takes a small wobble for a tap, not a drag', () => {
    layer.setEditable(true);
    layer.setTool('trendLine');
    container.dispatchEvent(pointer('pointerdown', 100, 100));
    container.dispatchEvent(pointer('pointermove', 105, 105));
    container.dispatchEvent(pointer('pointerup', 105, 105));
    expect(events.some((event) => event.type === 'drawing.create')).toBe(false);
    tap(300, 100);
    expect(
      events.find((event) => event.type === 'drawing.create'),
    ).toMatchObject({ draft: { points: [point(11, 895), point(30, 900)] } });
  });

  it('drags the first two anchors of a channel and taps the third', () => {
    layer.setEditable(true);
    layer.setTool('parallelChannel');
    container.dispatchEvent(pointer('pointerdown', 100, 100));
    container.dispatchEvent(pointer('pointermove', 300, 100));
    container.dispatchEvent(pointer('pointerup', 300, 100));
    expect(events.some((event) => event.type === 'drawing.create')).toBe(false);
    // A later drag aims the next anchor instead of starting a new drawing.
    container.dispatchEvent(pointer('pointerdown', 200, 300));
    container.dispatchEvent(pointer('pointermove', 200, 250));
    container.dispatchEvent(pointer('pointerup', 200, 200));
    expect(
      events.find((event) => event.type === 'drawing.create'),
    ).toMatchObject({
      draft: {
        type: 'PARALLEL_CHANNEL',
        points: [point(10, 900), point(30, 900), point(20, 800)],
      },
    });
  });

  it('aims a one-anchor drawing with a drag and places it at the lift', () => {
    layer.setEditable(true);
    layer.setTool('horizontalLine');
    container.dispatchEvent(pointer('pointerdown', 100, 100));
    container.dispatchEvent(pointer('pointermove', 100, 200));
    container.dispatchEvent(pointer('pointerup', 100, 300));
    expect(
      events.find((event) => event.type === 'drawing.create'),
    ).toMatchObject({
      draft: { type: 'HORIZONTAL_LINE', points: [{ price: '700' }] },
    });
  });

  it('keeps the browser from panning while a finger draws', () => {
    layer.setEditable(true);
    layer.setTool('trendLine');
    expect(container.style.touchAction).toBe('none');
    const idle = new Event('touchmove', { cancelable: true });
    container.dispatchEvent(idle);
    expect(idle.defaultPrevented).toBe(false);
    container.dispatchEvent(pointer('pointerdown', 100, 100));
    const held = new Event('touchmove', { cancelable: true });
    container.dispatchEvent(held);
    expect(held.defaultPrevented).toBe(true);
    layer.setTool(null);
    expect(container.style.touchAction).toBe('');
  });

  it('drops a drawing whose drag the system took away', () => {
    layer.setEditable(true);
    layer.setTool('trendLine');
    container.dispatchEvent(pointer('pointerdown', 100, 100));
    container.dispatchEvent(pointer('pointermove', 200, 200));
    container.dispatchEvent(pointer('pointercancel', 200, 200));
    tap(300, 100);
    expect(events.some((event) => event.type === 'drawing.create')).toBe(false);
    tap(200, 200);
    expect(
      events.find((event) => event.type === 'drawing.create'),
    ).toMatchObject({ draft: { points: [point(30, 900), point(20, 800)] } });
  });

  it('asks for the text of a text drawing instead of creating it', () => {
    layer.setEditable(true);
    layer.setTool('text');
    tap(100, 100);
    expect(events.find((event) => event.type === 'drawing.text')).toMatchObject(
      { draft: { type: 'TEXT' } },
    );
  });

  it('selects a drawing a finger presses near and drags it by an anchor', () => {
    layer.setEditable(true);
    layer.setDrawings([line('d1', point(10, 900), point(30, 900))]);
    // 14 px under the line: past a mouse's reach, within a finger's.
    const press = pointer('pointerdown', 200, 114);
    container.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    expect(events).toContainEqual({ type: 'drawing.select', id: 'd1' });
    expect(frozen()).toBe(true);
    container.dispatchEvent(pointer('pointerup', 200, 114));
    expect(frozen()).toBe(false);

    container.dispatchEvent(pointer('pointerdown', 300, 100));
    container.dispatchEvent(pointer('pointermove', 400, 50));
    container.dispatchEvent(pointer('pointerup', 400, 50));
    expect(events.at(-1)).toEqual({
      type: 'drawing.change',
      id: 'd1',
      points: [point(10, 900), point(40, 950)],
    });
  });

  it('leaves a press on an empty spot to the chart', () => {
    layer.setEditable(true);
    layer.setDrawings([line('d1', point(10, 900), point(30, 900))]);
    const press = pointer('pointerdown', 500, 300);
    container.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(false);
    expect(frozen()).toBe(false);
  });

  it('ignores a second finger and an anchor the system took away', () => {
    layer.setEditable(true);
    layer.setTool('horizontalLine');
    container.dispatchEvent(pointer('pointerdown', 100, 100));
    container.dispatchEvent(
      pointer('pointerdown', 300, 300, { pointerId: 2, isPrimary: false }),
    );
    container.dispatchEvent(pointer('pointercancel', 100, 100));
    expect(events).toEqual([]);
    tap(100, 100);
    expect(
      events.find((event) => event.type === 'drawing.create'),
    ).toMatchObject({ draft: { type: 'HORIZONTAL_LINE' } });
  });

  it('ignores a tool it does not know and puts the tool down on cancel', () => {
    layer.setEditable(true);
    layer.setTool('brush');
    expect(frozen()).toBe(false);
    layer.setTool('rectangle');
    tap(100, 100);
    layer.cancel();
    layer.cancel();
    expect(events).toContainEqual({ type: 'drawing.toolDone' });
    expect(frozen()).toBe(false);
    tap(200, 200);
    expect(events.some((event) => event.type === 'drawing.create')).toBe(false);
  });
});
