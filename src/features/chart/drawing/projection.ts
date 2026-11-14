import type { IChartApi, ISeriesApi, Logical } from 'lightweight-charts';
import type { Candle, DrawingPoint } from '../../../types/domain';
import { groupThousands } from '../../../utils/decimal-format';
import type { Projection } from './controller';
import type { FigureLabels, Pixel } from './geometry';
import { TimeAxis } from './time-axis';

/** A price rounded to `places`, never 0 or below (the backend refuses it). */
export function roundPrice(value: number, places: number): string {
  const smallest = 10 ** -places;
  const rounded = Math.max(value, smallest);
  return rounded.toFixed(places);
}

/** The bar's price nearest to `y`: its open, high, low or close. */
export function magnetPrice(
  bar: Candle,
  y: number,
  toY: (price: number) => number | null,
): number | null {
  let best: number | null = null;
  let distance = Infinity;
  for (const raw of [bar.open, bar.high, bar.low, bar.close]) {
    const price = Number(raw);
    const at = toY(price);
    if (at === null) continue;
    const gap = Math.abs(at - y);
    if (gap < distance) {
      distance = gap;
      best = price;
    }
  }
  return best;
}

/**
 * The projection of a candlestick chart: anchors to pane pixels through the
 * bar positions of `bars` (chart-time.ts moves them by `offset`), and back,
 * with prices at `places` decimals.
 */
export function chartProjection({
  chart,
  series,
  bars,
  barSeconds,
  offset,
  places,
  labels,
}: {
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
  bars: readonly Candle[];
  barSeconds: number;
  offset: number;
  places: number;
  labels: FigureLabels;
}): Projection {
  const axis = new TimeAxis(
    bars.map((bar) => Date.parse(bar.openTime) / 1000 + offset),
    barSeconds,
  );
  const scale = chart.timeScale();
  const toY = (price: number) => series.priceToCoordinate(price);
  const iso = (chartSeconds: number) =>
    new Date((chartSeconds - offset) * 1000).toISOString();
  const logicalOf = (time: string) =>
    axis.logicalOf(Date.parse(time) / 1000 + offset);
  return {
    context: {
      get width() {
        return scale.width();
      },
      get height() {
        return chart.panes()[0]?.getHeight() ?? 0;
      },
      y: toY,
      price: (price) =>
        (price < 0 ? '-' : '') +
        groupThousands(Math.abs(price).toFixed(places)),
      bars: (from, to) => {
        const a = axis.logicalOf(from + offset);
        const b = axis.logicalOf(to + offset);
        return a === null || b === null ? 0 : Math.round(b - a);
      },
      labels,
    },
    pixel: (point: DrawingPoint): Pixel | null => {
      const logical = logicalOf(point.time);
      if (logical === null) return null;
      const x = scale.logicalToCoordinate(logical as Logical);
      const y = toY(Number(point.price));
      return x === null || y === null ? null : { x, y };
    },
    point: (at, magnet) => {
      const logical = scale.coordinateToLogical(at.x);
      const raw = series.coordinateToPrice(at.y);
      if (logical === null || raw === null) return null;
      const time = axis.timeOf(logical);
      if (time === null) return null;
      let price: number = raw;
      const index = magnet ? axis.barIndex(logical) : null;
      const bar = index === null ? undefined : bars[index];
      if (bar) price = magnetPrice(bar, at.y, toY) ?? price;
      return { time: iso(time), price: roundPrice(price, places) };
    },
    later: (point, count) => {
      const logical = logicalOf(point.time);
      const time = logical === null ? null : axis.timeOf(logical + count);
      return time === null ? null : { time: iso(time), price: point.price };
    },
    scale: (price, factor) => roundPrice(Number(price) * (1 + factor), places),
  };
}
