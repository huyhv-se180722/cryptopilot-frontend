/**
 * Turns the time of an anchor into a bar position of the chart and back.
 * The chart places bars by index (its "logical" coordinate), and has no
 * place for a time between two bars or after the last one, so an anchor
 * drawn on another timeframe, or to the right of the last candle, is placed
 * by interpolating between bars or extrapolating one bar length per bar
 * (D-149 (4)).
 *
 * Times here are chart seconds: the instant moved by the chart's offset
 * (chart-time.ts).
 */
export class TimeAxis {
  private readonly times: readonly number[];
  private readonly barSeconds: number;

  /** `times` rise; `barSeconds` is the length of one bar of the timeframe. */
  constructor(times: readonly number[], barSeconds: number) {
    this.times = times;
    this.barSeconds = barSeconds;
  }

  get empty(): boolean {
    return this.times.length === 0;
  }

  /** The bar position of a time; fractional between two bars. */
  logicalOf(time: number): number | null {
    const times = this.times;
    const count = times.length;
    if (count === 0) return null;
    const first = times[0]!;
    const last = times[count - 1]!;
    if (time <= first) return (time - first) / this.barSeconds;
    if (time >= last) return count - 1 + (time - last) / this.barSeconds;
    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (times[middle]! <= time) low = middle;
      else high = middle;
    }
    const from = times[low]!;
    const to = times[high]!;
    return low + (time - from) / (to - from);
  }

  /** The time of a bar position, rounded to a whole bar. */
  timeOf(logical: number): number | null {
    const times = this.times;
    const count = times.length;
    if (count === 0) return null;
    const index = Math.round(logical);
    if (index < 0) return times[0]! + index * this.barSeconds;
    if (index >= count)
      return times[count - 1]! + (index - count + 1) * this.barSeconds;
    return times[index]!;
  }

  /** The index of the bar at a position, or null outside the bars. */
  barIndex(logical: number): number | null {
    const index = Math.round(logical);
    return index >= 0 && index < this.times.length ? index : null;
  }
}

/** The length of one bar of each timeframe, in seconds. */
export const BAR_SECONDS = {
  '15m': 900,
  '1h': 3_600,
  '4h': 14_400,
  '1d': 86_400,
} as const;
