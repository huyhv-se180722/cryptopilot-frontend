import type { MarketPair, MarketTicker } from '../../../types/domain';
import { compareDecimal } from '../../../utils/decimal-format';
import { signOf } from '../../../utils/decimal-sign';
import { add } from '../../../utils/decimal-math';

/** A pair with its live ticker, for the home hero. */
export interface PairQuote {
  pair: MarketPair;
  ticker: MarketTicker;
}

/** The hero's pair: BTC/USDT when enabled, else the most traded one. */
export const FEATURED_SYMBOL = 'BTCUSDT';

function quoted(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
): PairQuote[] {
  return pairs.flatMap((pair) => {
    const ticker = tickers.get(pair.symbol);
    return ticker ? [{ pair, ticker }] : [];
  });
}

/** Most traded first, by 24h quote volume; pairs without one go last. */
export function byVolume(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
  count: number,
): PairQuote[] {
  return quoted(pairs, tickers)
    .filter((row) => row.ticker.quoteVolume24h !== null)
    .sort((a, b) =>
      compareDecimal(b.ticker.quoteVolume24h!, a.ticker.quoteVolume24h!),
    )
    .slice(0, count);
}

export function featuredPair(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
): MarketPair | null {
  return (
    pairs.find((pair) => pair.symbol === FEATURED_SYMBOL) ??
    byVolume(pairs, tickers, 1)[0]?.pair ??
    pairs[0] ??
    null
  );
}

/**
 * The largest 24h rises and falls, `count` of each: only pairs that rose
 * are gainers and only pairs that fell are losers, so a calm market can
 * show fewer (never a falling pair among the gainers).
 */
export function topMovers(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
  count: number,
): { gainers: PairQuote[]; losers: PairQuote[] } {
  const ranked = quoted(pairs, tickers)
    .filter((row) => row.ticker.changePercent24h !== null)
    .sort((a, b) =>
      compareDecimal(b.ticker.changePercent24h!, a.ticker.changePercent24h!),
    );
  const sign = (row: PairQuote) => signOf(row.ticker.changePercent24h!);
  return {
    gainers: ranked.filter((row) => sign(row) === 'positive').slice(0, count),
    losers: ranked
      .filter((row) => sign(row) === 'negative')
      .reverse()
      .slice(0, count),
  };
}

/** How the Spot market moved as a whole over the last 24 hours. */
export interface Breadth {
  rising: number;
  falling: number;
  /** Rising pairs among those that moved, 0–100; null when none moved. */
  risingShare: number | null;
  /** Sum of the pairs' 24h quote volume (a decimal string), or null. */
  volume: string | null;
}

export function breadth(
  pairs: readonly MarketPair[],
  tickers: ReadonlyMap<string, MarketTicker>,
): Breadth {
  let rising = 0;
  let falling = 0;
  let volume: string | null = null;
  for (const { ticker } of quoted(pairs, tickers)) {
    const sign = ticker.changePercent24h
      ? signOf(ticker.changePercent24h)
      : 'zero';
    if (sign === 'positive') rising += 1;
    if (sign === 'negative') falling += 1;
    if (ticker.quoteVolume24h)
      volume = add(volume ?? '0', ticker.quoteVolume24h);
  }
  const moved = rising + falling;
  return {
    rising,
    falling,
    risingShare: moved === 0 ? null : Math.round((rising / moved) * 100),
    volume,
  };
}

/** A mover on the radar, at a place in percent of the radar's box. */
export interface RadarPoint extends PairQuote {
  side: 'rising' | 'falling';
  /** Percent of the box from the left and from the top. */
  x: number;
  y: number;
}

/** The radar's outer ring, as a share of the box from its centre. */
export const RADAR_OUTER = 0.42;
const NEAREST = 0.3;
const FARTHEST = 0.82;

/**
 * Arcs of the radar, in degrees from north, clockwise. Wide: the cards lie
 * over the top-right and bottom-left corners, so rising pairs keep to the
 * right (60°–150°) and falling ones to the upper left (280°–350°). Narrow:
 * the cards sit under the radar, so each side takes its whole half and the
 * labels have room on a small screen.
 */
const ARCS = {
  wide: { rising: [60, 150], falling: [280, 350] },
  narrow: { rising: [30, 150], falling: [210, 330] },
} as const;

/**
 * A label's box around its point, in percent of the radar's box: a rising
 * pair's label runs right of its dot, a falling pair's left of it. Sized
 * from the rendered labels (a dot and two lines, up to about 62 × 26 px)
 * with a few pixels to spare, for the radar's size in each layout: 480 px
 * from lg, down to 328 px on a 360 px phone.
 */
const LABEL = {
  wide: { width: 13, height: 6.5, dot: 2 },
  narrow: { width: 19, height: 9, dot: 3 },
} as const;
/** A crowded point moves along its own line by these steps, never nearer the hub than this. */
const NUDGE = 0.02;
const INNERMOST = 0.2;

export interface LabelBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function radarLabelBox(
  point: Pick<RadarPoint, 'side' | 'x' | 'y'>,
  layout: keyof typeof ARCS = 'wide',
): LabelBox {
  const label = LABEL[layout];
  const rising = point.side === 'rising';
  return {
    left: point.x - (rising ? label.dot : label.width),
    right: point.x + (rising ? label.width : label.dot),
    top: point.y - label.height / 2,
    bottom: point.y + label.height / 2,
  };
}

const collide = (a: LabelBox, b: LabelBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Where each mover sits on the radar: rising pairs on the right, falling
 * ones on the left (see `ARCS`); the bigger its 24h move against the
 * biggest one shown, the farther from the centre. Where two labels would
 * run into each other, the smaller move takes the nearest free place along
 * its own line, never past the biggest move (the label still gives its
 * exact change).
 */
export function radarPoints(
  gainers: readonly PairQuote[],
  losers: readonly PairQuote[],
  layout: keyof typeof ARCS = 'wide',
): RadarPoint[] {
  const size = (row: PairQuote) =>
    Math.abs(Number(row.ticker.changePercent24h ?? '0'));
  const largest = Math.max(0, ...[...gainers, ...losers].map(size));
  const at = (
    row: PairQuote,
    side: RadarPoint['side'],
    angle: number,
    reach: number,
  ): RadarPoint => ({
    ...row,
    side,
    x: 50 + 100 * RADAR_OUTER * reach * Math.sin(angle),
    y: 50 - 100 * RADAR_OUTER * reach * Math.cos(angle),
  });
  const place = (
    rows: readonly PairQuote[],
    side: RadarPoint['side'],
    from: number,
    to: number,
  ): RadarPoint[] => {
    const points: RadarPoint[] = [];
    const placed: RadarPoint[] = [];
    const free = (point: RadarPoint) =>
      placed.every(
        (other) =>
          !collide(radarLabelBox(point, layout), radarLabelBox(other, layout)),
      );
    // The biggest moves take their places first; smaller ones make room.
    const order = rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => size(b.row) - size(a.row));
    for (const { row, index } of order) {
      const angle =
        ((from + ((to - from) * (index + 0.5)) / rows.length) * Math.PI) / 180;
      const natural =
        largest === 0
          ? NEAREST
          : NEAREST + (FARTHEST - NEAREST) * (size(row) / largest);
      // Its own place first, then the nearest ones out and in; with none
      // free at all, it stays where its move puts it.
      const reaches = [natural];
      for (let step = NUDGE; step < FARTHEST - INNERMOST; step += NUDGE)
        reaches.push(
          ...[natural + step, natural - step].filter(
            (reach) => reach >= INNERMOST && reach <= FARTHEST,
          ),
        );
      const point =
        reaches.map((reach) => at(row, side, angle, reach)).find(free) ??
        at(row, side, angle, natural);
      placed.push(point);
      points[index] = point;
    }
    return points;
  };
  const [risingFrom, risingTo] = ARCS[layout].rising;
  const [fallingFrom, fallingTo] = ARCS[layout].falling;
  return [
    ...place(gainers, 'rising', risingFrom, risingTo),
    ...place(losers, 'falling', fallingFrom, fallingTo),
  ];
}
