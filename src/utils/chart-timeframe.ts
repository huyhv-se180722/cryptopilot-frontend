import type {
  CandleTimeframe,
  ChartTimeframe,
  MarketType,
} from '../types/domain';

/** The four stored timeframes (BR-08), drawn from the database and its stream. */
export const STORED_TIMEFRAMES: readonly CandleTimeframe[] = [
  '15m',
  '1h',
  '4h',
  '1d',
];

/** The sixteen candle intervals of the trading chart (TR-35); 1s on Spot only. */
export const CHART_TIMEFRAMES: readonly ChartTimeframe[] = [
  '1s',
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
];

export function chartTimeframesOf(
  market: MarketType,
): readonly ChartTimeframe[] {
  return market === 'spot'
    ? CHART_TIMEFRAMES
    : CHART_TIMEFRAMES.filter((tf) => tf !== '1s');
}

export function isStoredTimeframe(
  timeframe: ChartTimeframe,
): timeframe is CandleTimeframe {
  return (STORED_TIMEFRAMES as readonly string[]).includes(timeframe);
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A candle's length; a month's is not fixed (see `candleOpen`). */
export const TIMEFRAME_MS: Record<Exclude<ChartTimeframe, '1M'>, number> = {
  '1s': SECOND,
  '1m': MINUTE,
  '3m': 3 * MINUTE,
  '5m': 5 * MINUTE,
  '15m': 15 * MINUTE,
  '30m': 30 * MINUTE,
  '1h': HOUR,
  '2h': 2 * HOUR,
  '4h': 4 * HOUR,
  '6h': 6 * HOUR,
  '8h': 8 * HOUR,
  '12h': 12 * HOUR,
  '1d': DAY,
  '3d': 3 * DAY,
  '1w': 7 * DAY,
};

/** 1970-01-05, the first Monday after the epoch: the exchange's weeks start on Monday. */
const FIRST_MONDAY = 4 * DAY;

/**
 * The open of the candle an instant (ms) falls in, in UTC as the exchange
 * builds them: calendar months for 1M, Monday weeks for 1w, the candle
 * length from the epoch otherwise (3d included).
 */
export function candleOpen(time: number, timeframe: ChartTimeframe): number {
  if (timeframe === '1M') {
    const date = new Date(time);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  const span = TIMEFRAME_MS[timeframe];
  const base = timeframe === '1w' ? FIRST_MONDAY : 0;
  return Math.floor((time - base) / span) * span + base;
}

/** Daily and longer candles open at 00:00 UTC; shorter ones read in local time. */
export function isDailyOrLonger(timeframe: ChartTimeframe): boolean {
  return (
    timeframe === '1d' ||
    timeframe === '3d' ||
    timeframe === '1w' ||
    timeframe === '1M'
  );
}
