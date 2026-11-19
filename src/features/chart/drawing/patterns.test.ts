import { describe, expect, it } from 'vitest';
import type { DrawingStyle, DrawingType } from '../../../types/domain';
import { figureOf, type FigureContext, type Pixel } from './geometry';
import { crossing, isPattern, isTop, legRatio, SWING_NAMES } from './patterns';
import { ANCHORS } from './tools';

const STYLE: DrawingStyle = {
  lineColor: '#2962FF',
  lineWidth: 2,
  lineStyle: 'SOLID',
  fillColor: '#2962FF26',
  extendLeft: false,
  extendRight: false,
  fontSize: null,
  fibLevels: null,
};

/** Price p at y = (200 − p) × 2; bar i at x = 10i. */
const context: FigureContext = {
  width: 800,
  height: 400,
  y: (price) => (200 - price) * 2,
  price: (price) => price.toFixed(2),
  bars: (from, to) => (to - from) / 3600,
  labels: {
    target: '',
    stop: '',
    ratio: '',
    span: '',
    leftShoulder: 'Left shoulder',
    head: 'Head',
    rightShoulder: 'Right shoulder',
  },
};

function figure(type: DrawingType, prices: number[]) {
  const points = prices.map((price, i) => ({
    time: new Date(Date.UTC(2026, 10, 1, i)).toISOString(),
    price: String(price),
  }));
  const pixels: Pixel[] = prices.map((price, i) => ({
    x: 10 * (i + 1),
    y: (200 - price) * 2,
  }));
  return figureOf({ type, points, style: STYLE, text: null }, pixels, context)!;
}

const texts = (type: DrawingType, prices: number[]) =>
  figure(type, prices)
    .shapes.filter((shape) => shape.kind === 'text')
    .map((shape) => (shape.kind === 'text' ? shape.text : ''));

describe('pattern drawings (D-149)', () => {
  it('names as many swings as each type has anchors', () => {
    for (const [type, names] of Object.entries(SWING_NAMES))
      expect(names).toHaveLength(ANCHORS[type as DrawingType]);
    expect(isPattern('XABCD_PATTERN')).toBe(true);
    expect(isPattern('TREND_LINE')).toBe(false);
  });

  it('measures one leg against another', () => {
    expect(legRatio(-61.8, 100)).toBeCloseTo(0.618);
    expect(legRatio(5, 0)).toBeNull();
  });

  it('tells a top from a bottom and finds where two sides meet', () => {
    const swings = [
      { x: 0, y: 100 },
      { x: 10, y: 20 },
      { x: 20, y: 80 },
    ];
    expect([0, 1, 2].map((i) => isTop(swings, i))).toEqual([
      false,
      true,
      false,
    ]);
    expect(
      crossing(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 20 },
        { x: 10, y: 10 },
      ),
    ).toEqual({ x: 10, y: 10 });
    expect(
      crossing(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ),
    ).toBeNull();
  });

  it('labels an XABCD with its swings and the ratio of each leg', () => {
    // XA = 100, AB = 61.8, BC = 30.9 (0.5 of AB), CD = 61.8 (2.0 of BC).
    const labels = texts('XABCD_PATTERN', [100, 200, 138.2, 169.1, 107.3]);
    expect(labels).toEqual(
      expect.arrayContaining([
        'X',
        'A',
        'B',
        'C',
        'D',
        '0.618',
        '0.500',
        '2.000',
        '0.927',
      ]),
    );
    const shapes = figure(
      'XABCD_PATTERN',
      [100, 200, 138.2, 169.1, 107.3],
    ).shapes;
    expect(shapes.filter((shape) => shape.kind === 'polygon')).toHaveLength(2);
    expect(figure('XABCD_PATTERN', [1, 2, 3, 4, 5]).handles).toHaveLength(5);
  });

  it('gives a Cypher the C extension of XA and the D retracement of XC', () => {
    // XA = 100, C at 1.272 of XA from X, D back 0.786 of XC.
    const labels = texts('CYPHER_PATTERN', [100, 200, 150, 227.2, 127.22]);
    expect(labels).toEqual(expect.arrayContaining(['0.500', '1.272', '0.786']));
  });

  it('names the shoulders and the head and draws the neckline', () => {
    const shapes = figure(
      'HEAD_AND_SHOULDERS',
      [100, 150, 120, 180, 122, 150, 100],
    ).shapes;
    const labels = texts(
      'HEAD_AND_SHOULDERS',
      [100, 150, 120, 180, 122, 150, 100],
    );
    expect(labels).toEqual(['Left shoulder', 'Head', 'Right shoulder']);
    expect(shapes.filter((shape) => shape.kind === 'polygon')).toHaveLength(3);
    expect(
      shapes.filter(
        (shape) => shape.kind === 'segment' && shape.dash === 'DASHED',
      ),
    ).toHaveLength(1);
  });

  it('carries a converging triangle to its apex and an Elliott wave names its waves', () => {
    const triangle = figure('TRIANGLE_PATTERN', [180, 100, 160, 120]).shapes;
    expect(triangle.some((shape) => shape.kind === 'polygon')).toBe(true);
    expect(
      texts('ELLIOTT_IMPULSE_WAVE', [100, 130, 115, 170, 150, 190]),
    ).toEqual(['1', '2', '3', '4', '5']);
    expect(
      texts('ELLIOTT_TRIPLE_COMBO', [190, 150, 170, 130, 150, 110]),
    ).toEqual(['W', 'X', 'Y', 'X', 'Z']);
    expect(
      texts('THREE_DRIVES_PATTERN', [100, 130, 120, 150, 140, 170]),
    ).toEqual(expect.arrayContaining(['1', 'A', '2', 'B', '3']));
  });

  it('draws no fill when the Trader removed it', () => {
    const points = [100, 200, 150, 180, 120].map((price, i) => ({
      time: new Date(Date.UTC(2026, 10, 1, i)).toISOString(),
      price: String(price),
    }));
    const shapes = figureOf(
      {
        type: 'XABCD_PATTERN',
        points,
        style: { ...STYLE, fillColor: null },
        text: null,
      },
      points.map((_, i) => ({ x: i * 10, y: i * 5 })),
      context,
    )!.shapes;
    expect(shapes.some((shape) => shape.kind === 'polygon')).toBe(false);
  });
});
