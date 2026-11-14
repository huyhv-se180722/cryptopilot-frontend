import { describe, expect, it } from 'vitest';
import type { DrawingStyle } from '../../../types/domain';
import {
  distanceToSegment,
  duration,
  extendSegment,
  extensionPrice,
  figureOf,
  hitFigure,
  positionStats,
  retracementPrice,
  type Drawable,
  type FigureContext,
} from './geometry';
import { TimeAxis } from './time-axis';
import { DEFAULT_STYLE } from './tools';

/** 1 px per price unit, 1,000 at the top: price p sits at y = 1000 - p. */
const CONTEXT: FigureContext = {
  width: 800,
  height: 400,
  y: (price) => 1000 - price,
  price: (price) => price.toFixed(2),
  bars: (from, to) => (to - from) / 3600,
  labels: {
    target: 'Target {price} ({change})',
    stop: 'Stop {price} ({change})',
    ratio: 'R:R {ratio}',
    span: '{bars} bars, {time}',
  },
};

const drawable = (
  type: Drawable['type'],
  prices: readonly string[],
  style: Partial<DrawingStyle> = {},
  text: string | null = null,
): Drawable => ({
  type,
  points: prices.map((price, i) => ({
    time: new Date(Date.UTC(2026, 10, 10, i)).toISOString(),
    price,
  })),
  style: { ...DEFAULT_STYLE, ...style },
  text,
});

describe('time axis', () => {
  const axis = new TimeAxis([0, 3600, 7200, 14400], 3600);

  it('places a time on its bar, between bars and past the last one', () => {
    expect(axis.logicalOf(3600)).toBe(1);
    expect(axis.logicalOf(10800)).toBe(2.5);
    expect(axis.logicalOf(14400 + 7200)).toBe(5);
    expect(axis.logicalOf(-3600)).toBe(-1);
  });

  it('turns a position back into the time of a whole bar', () => {
    expect(axis.timeOf(1.4)).toBe(3600);
    expect(axis.timeOf(5)).toBe(14400 + 7200);
    expect(axis.timeOf(-2)).toBe(-7200);
    expect(axis.barIndex(2.6)).toBe(3);
    expect(axis.barIndex(9)).toBeNull();
    expect(new TimeAxis([], 60).logicalOf(1)).toBeNull();
  });
});

describe('figure maths', () => {
  it('extends a segment to the edges in the direction it was drawn', () => {
    const a = { x: 100, y: 100 };
    const b = { x: 200, y: 200 };
    expect(extendSegment(a, b, false, true, 800, 400)).toEqual([
      a,
      { x: 800, y: 800 },
    ]);
    expect(extendSegment(b, a, false, true, 800, 400)[0]).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      extendSegment({ x: 5, y: 10 }, { x: 5, y: 50 }, true, false, 800, 400),
    ).toEqual([
      { x: 5, y: 0 },
      { x: 5, y: 400 },
    ]);
  });

  it('measures the distance to a segment, its ends included', () => {
    expect(
      distanceToSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ).toBe(10);
    expect(
      distanceToSegment({ x: 130, y: 40 }, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ).toBe(50);
  });

  it('computes Fibonacci levels, position stats and durations', () => {
    expect(retracementPrice(100, 200, 0.5)).toBe(150);
    expect(retracementPrice(100, 200, 0)).toBe(200);
    expect(extensionPrice(100, 200, 150, 1.618)).toBeCloseTo(311.8);
    expect(positionStats(true, 100, 90, 120)).toMatchObject({
      risk: 10,
      reward: 20,
      ratio: 2,
      rewardPct: 20,
    });
    expect(positionStats(false, 100, 110, 85).ratio).toBe(1.5);
    expect(positionStats(true, 100, 100, 120).ratio).toBeNull();
    expect(duration(45 * 60)).toBe('45m');
    expect(duration(6 * 3600)).toBe('6h');
    expect(duration(90 * 60)).toBe('1h 30m');
    expect(duration(52 * 3600)).toBe('2d 4h');
    expect(duration(-86400)).toBe('1d');
  });
});

describe('figures and hits', () => {
  const at = (x: number, price: number) => ({ x, y: 1000 - price });

  it('cannot place a figure with an anchor off the scale', () => {
    expect(
      figureOf(drawable('TREND_LINE', ['1', '2']), [null, at(0, 2)], CONTEXT),
    ).toBeNull();
  });

  it('hits a trend line near its stroke and a handle only when selected', () => {
    const figure = figureOf(
      drawable('TREND_LINE', ['800', '700'], {}, 'breakout'),
      [at(100, 800), at(300, 700)],
      CONTEXT,
    )!;
    expect(hitFigure(figure, { x: 200, y: 252 }, false)).toEqual({
      part: 'body',
    });
    expect(hitFigure(figure, { x: 200, y: 290 }, false)).toBeNull();
    expect(hitFigure(figure, { x: 101, y: 201 }, true)).toEqual({
      part: 'handle',
      index: 0,
    });
    expect(figure.shapes.some((shape) => shape.kind === 'text')).toBe(true);
  });

  it('draws a horizontal line across the pane with its price', () => {
    const figure = figureOf(
      drawable('HORIZONTAL_LINE', ['750']),
      [at(400, 750)],
      CONTEXT,
    )!;
    const [line, label] = figure.shapes;
    expect(line).toMatchObject({
      from: { x: 0, y: 250 },
      to: { x: 800, y: 250 },
    });
    expect(label).toMatchObject({ kind: 'text', text: '750.00' });
    expect(hitFigure(figure, { x: 10, y: 252 }, false)).toEqual({
      part: 'body',
    });
  });

  it('fills a rectangle, extended to the right edge when asked', () => {
    const figure = figureOf(
      drawable('RECTANGLE', ['800', '700'], {
        fillColor: '#00000033',
        extendRight: true,
      }),
      [at(100, 800), at(300, 700)],
      CONTEXT,
    )!;
    expect(figure.shapes[0]).toMatchObject({
      kind: 'rect',
      to: { x: 800, y: 300 },
    });
    expect(hitFigure(figure, { x: 600, y: 250 }, false)).toEqual({
      part: 'body',
    });
  });

  it('places a retracement level at each ratio, the default set or the chosen one', () => {
    const figure = figureOf(
      drawable('FIB_RETRACEMENT', ['900', '700']),
      [at(100, 900), at(300, 700)],
      CONTEXT,
    )!;
    const labels = figure.shapes.filter((shape) => shape.kind === 'text');
    expect(labels).toHaveLength(7);
    expect(
      labels.map((shape) => (shape.kind === 'text' ? shape.text : '')),
    ).toContain('0.5 (800.00)');
    const chosen = figureOf(
      drawable('FIB_RETRACEMENT', ['900', '700'], { fibLevels: ['0.618'] }),
      [at(100, 900), at(300, 700)],
      CONTEXT,
    )!;
    expect(chosen.shapes.filter((shape) => shape.kind === 'text')).toHaveLength(
      1,
    );
  });

  it('shows a long position with its zones, target, stop and ratio', () => {
    const figure = figureOf(
      drawable('LONG_POSITION', ['800', '780', '840']),
      [at(100, 800), at(300, 780), at(300, 840)],
      CONTEXT,
    )!;
    const texts = figure.shapes.flatMap((shape) =>
      shape.kind === 'text' ? [shape.text] : [],
    );
    expect(texts).toEqual([
      'Target 840.00 (+5.00%)',
      'Stop 780.00 (-2.50%)',
      'R:R 2.00',
    ]);
    expect(figure.handles).toEqual([at(100, 800), at(300, 780), at(300, 840)]);
  });

  it('labels the measures, the channel and the text', () => {
    const range = figureOf(
      drawable('PRICE_RANGE', ['800', '880']),
      [at(100, 800), at(200, 880)],
      CONTEXT,
    )!;
    expect(
      range.shapes.some(
        (s) => s.kind === 'text' && s.text === '80.00 (+10.00%)',
      ),
    ).toBe(true);
    const span = figureOf(
      drawable('DATE_RANGE', ['800', '800']),
      [at(100, 800), at(200, 800)],
      CONTEXT,
    )!;
    expect(
      span.shapes.some((s) => s.kind === 'text' && s.text === '1 bars, 1h'),
    ).toBe(true);
    const channel = figureOf(
      drawable('PARALLEL_CHANNEL', ['800', '820', '760'], {
        fillColor: '#00000011',
      }),
      [at(100, 800), at(300, 820), at(200, 760)],
      CONTEXT,
    )!;
    expect(channel.shapes[0]).toMatchObject({ kind: 'polygon' });
    expect(hitFigure(channel, { x: 200, y: 215 }, false)).toEqual({
      part: 'body',
    });
    const note = figureOf(
      drawable('TEXT', ['800'], { fontSize: 20 }, 'FOMC'),
      [at(100, 800)],
      CONTEXT,
    )!;
    expect(note.shapes[0]).toMatchObject({
      kind: 'text',
      text: 'FOMC',
      size: 20,
    });
    expect(hitFigure(note, { x: 110, y: 200 }, false)).toEqual({
      part: 'body',
    });
    const vertical = figureOf(
      drawable('VERTICAL_LINE', ['1'], {}, 'CPI'),
      [at(150, 1)],
      CONTEXT,
    )!;
    expect(vertical.shapes[0]).toMatchObject({
      from: { x: 150, y: 0 },
      to: { x: 150, y: 400 },
    });
    const extension = figureOf(
      drawable('FIB_EXTENSION', ['700', '800', '750']),
      [at(100, 700), at(200, 800), at(300, 750)],
      CONTEXT,
    )!;
    expect(extension.shapes.filter((s) => s.kind === 'text')).toHaveLength(5);
    const arrow = figureOf(
      drawable('ARROW', ['700', '800']),
      [at(100, 700), at(200, 800)],
      CONTEXT,
    )!;
    expect(arrow.shapes[0]).toMatchObject({ kind: 'segment', arrow: true });
  });
});
