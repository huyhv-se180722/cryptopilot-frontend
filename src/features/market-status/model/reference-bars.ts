import type { Candle, CandleTimeframe } from '../../../types/domain';
import type { FallbackCandle } from '../../../services/api/market-status';
import { compare } from '../../../utils/decimal-math';

const SECONDS: Record<CandleTimeframe, number> = {
  '15m': 900,
  '1h': 3_600,
  '4h': 14_400,
  '1d': 86_400,
};

/**
 * The display-only reference one-minute candles of a lost market (D-159)
 * merged into bars of the chart's timeframe, in UTC buckets as the
 * exchange's: the first open, the highest high, the lowest low, the last
 * close. Volumes are not added up (they are another venue's), so the
 * Volume panel shows none. Exact decimals; nothing is stored.
 */
export function referenceBars(
  candles: readonly FallbackCandle[],
  timeframe: CandleTimeframe,
): Candle[] {
  const span = SECONDS[timeframe] * 1000;
  const bars: Candle[] = [];
  let bucket = Number.NaN;
  for (const candle of candles) {
    const start = Math.floor(Date.parse(candle.openTime) / span) * span;
    const last = bars[bars.length - 1];
    if (last && start === bucket) {
      last.close = candle.close;
      if (compare(candle.high, last.high) > 0) last.high = candle.high;
      if (compare(candle.low, last.low) < 0) last.low = candle.low;
      continue;
    }
    bucket = start;
    bars.push({
      openTime: new Date(start).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      baseVolume: '0',
      quoteVolume: '0',
    });
  }
  return bars;
}
