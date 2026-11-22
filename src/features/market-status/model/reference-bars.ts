import type { Candle, ChartTimeframe } from '../../../types/domain';
import { candleOpen } from '../../../utils/chart-timeframe';
import type { FallbackCandle } from '../../../services/api/market-status';
import { compare } from '../../../utils/decimal-math';

/**
 * The display-only reference one-minute candles of a lost market (D-159)
 * merged into bars of the chart's timeframe, in UTC buckets as the
 * exchange's: the first open, the highest high, the lowest low, the last
 * close. Volumes are not added up (they are another venue's), so the
 * Volume panel shows none. Exact decimals; nothing is stored.
 */
export function referenceBars(
  candles: readonly FallbackCandle[],
  timeframe: ChartTimeframe,
): Candle[] {
  const bars: Candle[] = [];
  let bucket = Number.NaN;
  for (const candle of candles) {
    const start = candleOpen(Date.parse(candle.openTime), timeframe);
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
