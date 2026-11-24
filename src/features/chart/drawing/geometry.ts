import type {
  Decimal,
  DrawingPoint,
  DrawingStyle,
  DrawingType,
} from '../../../types/domain';
import { patternShapes } from './patterns';
import { FIB_EXTENSION_LEVELS, FIB_RETRACEMENT_LEVELS } from './tools';

export interface Pixel {
  x: number;
  y: number;
}

/** What a figure is computed from: a drawing or the one being placed. */
export interface Drawable {
  type: DrawingType;
  points: readonly DrawingPoint[];
  style: DrawingStyle;
  text: string | null;
}

/** What the figure needs from the chart, besides its anchors in pixels. */
export interface FigureContext {
  width: number;
  height: number;
  /** The y of a price on the price pane, or null when the scale has none. */
  y: (price: number) => number | null;
  /** A price as the pair's tick precision shows it. */
  price: (price: number) => string;
  /** Bars between two times of the drawing, for the date range. */
  bars: (from: number, to: number) => number;
  /**
   * Label templates (`{price}`, `{change}`, `{ratio}`, `{bars}`, `{time}`)
   * and the names of a head and shoulders' swings.
   */
  labels: FigureLabels;
}

export interface FigureLabels {
  target: string;
  stop: string;
  ratio: string;
  span: string;
  leftShoulder: string;
  head: string;
  rightShoulder: string;
}

function fill(
  template: string,
  args: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in args ? String(args[name]) : match,
  );
}

export type Shape =
  | {
      kind: 'segment';
      from: Pixel;
      to: Pixel;
      color: string;
      width: number;
      dash: DrawingStyle['lineStyle'];
      arrow?: boolean;
    }
  | {
      kind: 'rect';
      from: Pixel;
      to: Pixel;
      fill: string | null;
      stroke: string | null;
      width: number;
    }
  | { kind: 'polygon'; points: readonly Pixel[]; fill: string }
  | {
      kind: 'text';
      at: Pixel;
      text: string;
      color: string;
      size: number;
      align: CanvasTextAlign;
      baseline: CanvasTextBaseline;
      background?: string;
    };

export interface Figure {
  shapes: readonly Shape[];
  /** The handles the Trader drags, one per anchor. */
  handles: readonly Pixel[];
}

export const PROFIT_FILL = '#26A69A40';
export const LOSS_FILL = '#EF535040';
const LABEL_COLOR = '#FFFFFF';
const PROFIT_LABEL = '#26A69A';
const LOSS_LABEL = '#EF5350';

/** The point of the line through `a` and `b` at `x`. */
function atX(a: Pixel, b: Pixel, x: number): Pixel {
  if (b.x === a.x) return { x, y: a.y };
  return { x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) };
}

/**
 * The segment `a`-`b`, carried to the left and/or right edge of the pane.
 * A vertical segment is carried to the top and bottom instead.
 */
export function extendSegment(
  a: Pixel,
  b: Pixel,
  left: boolean,
  right: boolean,
  width: number,
  height: number,
): [Pixel, Pixel] {
  if (a.x === b.x) {
    const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
    return [
      left || right ? { x: a.x, y: 0 } : top,
      left || right ? { x: a.x, y: height } : bottom,
    ];
  }
  const [start, end] = a.x <= b.x ? [a, b] : [b, a];
  // "Left" and "right" follow the order the Trader drew in.
  const extendStart = a.x <= b.x ? left : right;
  const extendEnd = a.x <= b.x ? right : left;
  return [
    extendStart ? atX(start, end, 0) : start,
    extendEnd ? atX(start, end, width) : end,
  ];
}

/** Distance from `p` to the segment `a`-`b`. */
export function distanceToSegment(p: Pixel, a: Pixel, b: Pixel): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
        );
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The price at a Fibonacci level of a retracement from `start` to `end`. */
export function retracementPrice(
  start: number,
  end: number,
  level: number,
): number {
  return end + (start - end) * level;
}

/** The price at a Fibonacci level of an extension A-B projected from C. */
export function extensionPrice(
  a: number,
  b: number,
  c: number,
  level: number,
): number {
  return c + (b - a) * level;
}

/** Stop and target as distances from the entry, and their ratio. */
export function positionStats(
  long: boolean,
  entry: number,
  stop: number,
  target: number,
): {
  risk: number;
  reward: number;
  riskPct: number;
  rewardPct: number;
  ratio: number | null;
} {
  const risk = long ? entry - stop : stop - entry;
  const reward = long ? target - entry : entry - target;
  return {
    risk,
    reward,
    riskPct: entry === 0 ? 0 : (risk / entry) * 100,
    rewardPct: entry === 0 ? 0 : (reward / entry) * 100,
    ratio: risk > 0 ? reward / risk : null,
  };
}

/** "45m", "6h", "2d 4h". */
export function duration(seconds: number): string {
  const minutes = Math.round(Math.abs(seconds) / 60);
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  return `${rest}m`;
}

const percent = (value: number) =>
  (value >= 0 ? '+' : '') + value.toFixed(2) + '%';

function levelsOf(style: DrawingStyle, fallback: readonly Decimal[]) {
  return (style.fibLevels ?? fallback).map(Number);
}

/**
 * The shapes and handles of a drawing on the price pane. `pixels` are its
 * anchors projected by the chart; a figure that cannot be placed (no price
 * scale yet) is null.
 */
export function figureOf(
  drawing: Drawable,
  pixels: readonly (Pixel | null)[],
  context: FigureContext,
): Figure | null {
  if (pixels.some((pixel) => pixel === null)) return null;
  const p = pixels as readonly Pixel[];
  const { style } = drawing;
  const { width, height } = context;
  const line = (from: Pixel, to: Pixel, extra: Partial<Shape> = {}): Shape =>
    ({
      kind: 'segment',
      from,
      to,
      color: style.lineColor,
      width: style.lineWidth,
      dash: style.lineStyle,
      ...extra,
    }) as Shape;
  const label = (
    at: Pixel,
    text: string,
    align: CanvasTextAlign,
    baseline: CanvasTextBaseline,
    color = style.lineColor,
    background?: string,
  ): Shape => ({
    kind: 'text',
    at,
    text,
    color,
    size: 12,
    align,
    baseline,
    ...(background ? { background } : {}),
  });
  const prices = drawing.points.map((point) => Number(point.price));
  const shapes: Shape[] = [];
  const note = drawing.text;

  switch (drawing.type) {
    case 'TREND_LINE':
    case 'ARROW': {
      const [from, to] = extendSegment(
        p[0]!,
        p[1]!,
        drawing.type === 'TREND_LINE' && style.extendLeft,
        drawing.type === 'TREND_LINE' && style.extendRight,
        width,
        height,
      );
      shapes.push(
        line(from, to, drawing.type === 'ARROW' ? { arrow: true } : {}),
      );
      if (note)
        shapes.push(
          label(
            { x: (p[0]!.x + p[1]!.x) / 2, y: (p[0]!.y + p[1]!.y) / 2 - 6 },
            note,
            'center',
            'bottom',
          ),
        );
      return { shapes, handles: [p[0]!, p[1]!] };
    }
    case 'HORIZONTAL_LINE':
    case 'HORIZONTAL_RAY': {
      const from =
        drawing.type === 'HORIZONTAL_LINE' ? { x: 0, y: p[0]!.y } : p[0]!;
      shapes.push(line(from, { x: width, y: p[0]!.y }));
      shapes.push(
        label(
          { x: width - 4, y: p[0]!.y - 3 },
          (note ? note + '  ' : '') + context.price(prices[0]!),
          'right',
          'bottom',
        ),
      );
      return { shapes, handles: [p[0]!] };
    }
    case 'VERTICAL_LINE': {
      shapes.push(line({ x: p[0]!.x, y: 0 }, { x: p[0]!.x, y: height }));
      if (note)
        shapes.push(label({ x: p[0]!.x + 4, y: 4 }, note, 'left', 'top'));
      return { shapes, handles: [p[0]!] };
    }
    case 'RECTANGLE': {
      const right = style.extendRight ? width : Math.max(p[0]!.x, p[1]!.x);
      const left = style.extendLeft ? 0 : Math.min(p[0]!.x, p[1]!.x);
      const from = { x: left, y: Math.min(p[0]!.y, p[1]!.y) };
      const to = { x: right, y: Math.max(p[0]!.y, p[1]!.y) };
      shapes.push({
        kind: 'rect',
        from,
        to,
        fill: style.fillColor,
        stroke: style.lineColor,
        width: style.lineWidth,
      });
      if (note)
        shapes.push(
          label({ x: from.x + 4, y: from.y + 4 }, note, 'left', 'top'),
        );
      return { shapes, handles: [p[0]!, p[1]!] };
    }
    case 'PRICE_RANGE':
    case 'DATE_RANGE': {
      const from = {
        x: Math.min(p[0]!.x, p[1]!.x),
        y: Math.min(p[0]!.y, p[1]!.y),
      };
      const to = {
        x: Math.max(p[0]!.x, p[1]!.x),
        y: Math.max(p[0]!.y, p[1]!.y),
      };
      shapes.push({
        kind: 'rect',
        from,
        to,
        fill: style.fillColor,
        stroke: null,
        width: 0,
      });
      if (drawing.type === 'PRICE_RANGE') {
        const x = (from.x + to.x) / 2;
        shapes.push(
          line({ x, y: p[0]!.y }, { x, y: p[1]!.y }, { arrow: true }),
        );
        const change = prices[1]! - prices[0]!;
        shapes.push(
          label(
            { x, y: p[1]!.y + (p[1]!.y <= p[0]!.y ? -6 : 6) },
            `${context.price(change)} (${percent(prices[0] ? (change / prices[0]) * 100 : 0)})`,
            'center',
            p[1]!.y <= p[0]!.y ? 'bottom' : 'top',
            LABEL_COLOR,
            style.lineColor,
          ),
        );
      } else {
        const y = (from.y + to.y) / 2;
        shapes.push(
          line({ x: p[0]!.x, y }, { x: p[1]!.x, y }, { arrow: true }),
        );
        const seconds =
          (Date.parse(drawing.points[1]!.time) -
            Date.parse(drawing.points[0]!.time)) /
          1000;
        const bars = context.bars(
          Date.parse(drawing.points[0]!.time) / 1000,
          Date.parse(drawing.points[1]!.time) / 1000,
        );
        shapes.push(
          label(
            { x: (from.x + to.x) / 2, y: to.y + 6 },
            fill(context.labels.span, {
              bars: Math.abs(bars),
              time: duration(seconds),
            }),
            'center',
            'top',
            LABEL_COLOR,
            style.lineColor,
          ),
        );
      }
      return { shapes, handles: [p[0]!, p[1]!] };
    }
    case 'FIB_RETRACEMENT':
    case 'FIB_EXTENSION': {
      const retracement = drawing.type === 'FIB_RETRACEMENT';
      const levels = levelsOf(
        style,
        retracement ? FIB_RETRACEMENT_LEVELS : FIB_EXTENSION_LEVELS,
      );
      const xs = p.map((pixel) => pixel.x);
      const left = style.extendLeft ? 0 : Math.min(...xs);
      const right = style.extendRight ? width : Math.max(...xs);
      if (retracement)
        shapes.push(line(p[0]!, p[1]!, { dash: 'DASHED', width: 1 }));
      else {
        shapes.push(line(p[0]!, p[1]!, { dash: 'DASHED', width: 1 }));
        shapes.push(line(p[1]!, p[2]!, { dash: 'DASHED', width: 1 }));
      }
      for (const level of levels) {
        const price = retracement
          ? retracementPrice(prices[0]!, prices[1]!, level)
          : extensionPrice(prices[0]!, prices[1]!, prices[2]!, level);
        const y = context.y(price);
        if (y === null) continue;
        shapes.push(
          line({ x: left, y }, { x: right, y }, { width: 1, dash: 'SOLID' }),
        );
        shapes.push(
          label(
            { x: Math.max(left, 0) + 4, y: y - 2 },
            `${level} (${context.price(price)})`,
            'left',
            'bottom',
          ),
        );
      }
      return { shapes, handles: p };
    }
    case 'PARALLEL_CHANNEL': {
      const offset = p[2]!.y - atX(p[0]!, p[1]!, p[2]!.x).y;
      const [a, b] = extendSegment(
        p[0]!,
        p[1]!,
        style.extendLeft,
        style.extendRight,
        width,
        height,
      );
      const c = { x: a.x, y: a.y + offset };
      const d = { x: b.x, y: b.y + offset };
      if (style.fillColor)
        shapes.push({
          kind: 'polygon',
          points: [a, b, d, c],
          fill: style.fillColor,
        });
      shapes.push(line(a, b));
      shapes.push(line(c, d));
      const handle = {
        x: (p[0]!.x + p[1]!.x) / 2,
        y: (p[0]!.y + p[1]!.y) / 2 + offset,
      };
      return { shapes, handles: [p[0]!, p[1]!, handle] };
    }
    case 'LONG_POSITION':
    case 'SHORT_POSITION': {
      const long = drawing.type === 'LONG_POSITION';
      const [entry, stop, target] = p as [Pixel, Pixel, Pixel];
      const left = Math.min(entry.x, stop.x);
      const right = Math.max(entry.x, stop.x, left + 1);
      shapes.push({
        kind: 'rect',
        from: { x: left, y: Math.min(entry.y, target.y) },
        to: { x: right, y: Math.max(entry.y, target.y) },
        fill: PROFIT_FILL,
        stroke: null,
        width: 0,
      });
      shapes.push({
        kind: 'rect',
        from: { x: left, y: Math.min(entry.y, stop.y) },
        to: { x: right, y: Math.max(entry.y, stop.y) },
        fill: LOSS_FILL,
        stroke: null,
        width: 0,
      });
      shapes.push(
        line(
          { x: left, y: entry.y },
          { x: right, y: entry.y },
          { width: 1, color: '#787B86', dash: 'SOLID' },
        ),
      );
      const stats = positionStats(long, prices[0]!, prices[1]!, prices[2]!);
      const middle = (left + right) / 2;
      const targetAbove = target.y < entry.y;
      shapes.push(
        label(
          { x: middle, y: target.y + (targetAbove ? -4 : 4) },
          fill(context.labels.target, {
            price: context.price(prices[2]!),
            change: percent(stats.rewardPct),
          }),
          'center',
          targetAbove ? 'bottom' : 'top',
          LABEL_COLOR,
          PROFIT_LABEL,
        ),
        label(
          { x: middle, y: stop.y + (targetAbove ? 4 : -4) },
          fill(context.labels.stop, {
            price: context.price(prices[1]!),
            change: percent(-stats.riskPct),
          }),
          'center',
          targetAbove ? 'top' : 'bottom',
          LABEL_COLOR,
          LOSS_LABEL,
        ),
        label(
          { x: middle, y: entry.y },
          fill(context.labels.ratio, {
            ratio: stats.ratio === null ? '–' : stats.ratio.toFixed(2),
          }),
          'center',
          'middle',
          LABEL_COLOR,
          '#787B86',
        ),
      );
      // The stop and target handles sit on the right edge, the entry's on the left.
      return {
        shapes,
        handles: [
          { x: left, y: entry.y },
          { x: right, y: stop.y },
          { x: right, y: target.y },
        ],
      };
    }
    case 'TEXT': {
      shapes.push({
        kind: 'text',
        at: p[0]!,
        text: note ?? '',
        color: style.lineColor,
        size: style.fontSize ?? 14,
        align: 'left',
        baseline: 'middle',
        ...(style.fillColor ? { background: style.fillColor } : {}),
      });
      return { shapes, handles: [p[0]!] };
    }
    default:
      return {
        shapes: patternShapes(
          drawing.type,
          p,
          prices,
          style,
          context.labels,
          width,
        ),
        handles: p,
      };
  }
}

/** What a pointer is over: a handle of the figure, its body, or nothing. */
export type FigureHit = { part: 'handle'; index: number } | { part: 'body' };

const HANDLE_RADIUS = 6;
const LINE_TOLERANCE = 5;

/**
 * The lines of a label, one per line the Trader typed, the step from one
 * line to the next and the height of them all. The canvas and the hit test
 * share it, so a note on several lines is drawn and picked the same.
 */
export function textBlock(text: string, size: number) {
  const lines = text.split('\n');
  const step = Math.round(size * 1.25);
  return { lines, step, height: size + (lines.length - 1) * step };
}

/** Approximate width of a label, for hit testing without a canvas. */
function textWidth(text: string, size: number): number {
  return (
    Math.max(...textBlock(text, size).lines.map((line) => line.length)) *
    size *
    0.6
  );
}

function insideRect(p: Pixel, from: Pixel, to: Pixel, margin = 0): boolean {
  return (
    p.x >= Math.min(from.x, to.x) - margin &&
    p.x <= Math.max(from.x, to.x) + margin &&
    p.y >= Math.min(from.y, to.y) - margin &&
    p.y <= Math.max(from.y, to.y) + margin
  );
}

function insidePolygon(p: Pixel, points: readonly Pixel[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Whether `p` is on the figure; handles are tested before the body. */
export function hitFigure(
  figure: Figure,
  p: Pixel,
  withHandles: boolean,
): FigureHit | null {
  if (withHandles) {
    const index = figure.handles.findIndex(
      (handle) =>
        Math.hypot(handle.x - p.x, handle.y - p.y) <= HANDLE_RADIUS + 2,
    );
    if (index >= 0) return { part: 'handle', index };
  }
  for (const shape of figure.shapes) {
    switch (shape.kind) {
      case 'segment':
        if (
          distanceToSegment(p, shape.from, shape.to) <=
          LINE_TOLERANCE + shape.width / 2
        )
          return { part: 'body' };
        break;
      case 'rect':
        if (
          shape.fill
            ? insideRect(p, shape.from, shape.to)
            : insideRect(p, shape.from, shape.to, LINE_TOLERANCE) &&
              !insideRect(p, shape.from, shape.to, -LINE_TOLERANCE)
        )
          return { part: 'body' };
        break;
      case 'polygon':
        if (insidePolygon(p, shape.points)) return { part: 'body' };
        break;
      case 'text': {
        const w = textWidth(shape.text, shape.size);
        const h = textBlock(shape.text, shape.size).height;
        const x0 =
          shape.align === 'right'
            ? shape.at.x - w
            : shape.align === 'center'
              ? shape.at.x - w / 2
              : shape.at.x;
        const y0 =
          shape.baseline === 'bottom'
            ? shape.at.y - h
            : shape.baseline === 'middle'
              ? shape.at.y - h / 2
              : shape.at.y;
        if (insideRect(p, { x: x0, y: y0 }, { x: x0 + w, y: y0 + h }, 2))
          return { part: 'body' };
        break;
      }
    }
  }
  return null;
}

export { HANDLE_RADIUS };
