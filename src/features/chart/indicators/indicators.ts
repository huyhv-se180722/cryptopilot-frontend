/**
 * Indicator series for drawing only (D-96, proposed; FEQ-04): the backend
 * returns the latest values, so the chart computes the history itself with
 * the definitions and seeds of BR-12 / TECHNICAL_DESIGN 7.2, D-52 and
 * D-55. Numbers are allowed here (indicators, not money). The analysis
 * card keeps showing the backend's own values.
 *
 * Every function returns one entry per input, `null` until its seed is
 * complete.
 */
export type Series = (number | null)[];

/** SMA(n): rolling sum over the last n values; first value at n − 1. */
export function sma(values: readonly number[], n: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  values.forEach((value, i) => {
    sum += value;
    if (i >= n) sum -= values[i - n] as number;
    if (i >= n - 1) out[i] = sum / n;
  });
  return out;
}

/** EMA(n), α = 2/(n+1), seeded with the SMA of the first n values. */
export function ema(values: readonly number[], n: number): Series {
  const out: Series = new Array(values.length).fill(null);
  const alpha = 2 / (n + 1);
  let current: number | null = null;
  let seed = 0;
  values.forEach((value, i) => {
    if (current === null) {
      seed += value;
      if (i === n - 1) current = seed / n;
    } else {
      current = alpha * value + (1 - alpha) * current;
    }
    out[i] = current;
  });
  return out;
}

/**
 * RSI(14), Wilder: averages seeded with the simple mean of the first 14
 * gains and losses, then smoothed with 13/14. AL = 0 and AG > 0 → 100;
 * AG = AL = 0 → 50 (D-55).
 */
export function rsi(closes: readonly number[], n = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < closes.length; i += 1) {
    const change = (closes[i] as number) - (closes[i - 1] as number);
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    if (i <= n) {
      gain += up;
      loss += down;
      if (i < n) continue;
      gain /= n;
      loss /= n;
    } else {
      gain = (gain * (n - 1) + up) / n;
      loss = (loss * (n - 1) + down) / n;
    }
    out[i] =
      loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export interface MacdSeries {
  line: Series;
  signal: Series;
  histogram: Series;
}

/**
 * MACD(12, 26, 9) as D-52: each EMA seeded on its own (EMA12 at candle 12,
 * EMA26 at 26), the line from candle 26, the signal seeded with the mean
 * of the first 9 lines (candle 34).
 */
export function macd(
  closes: readonly number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdSeries {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line: Series = closes.map((_, i) => {
    const a = fastEma[i];
    const b = slowEma[i];
    return a === null || a === undefined || b === null || b === undefined
      ? null
      : a - b;
  });
  const first = line.findIndex((value) => value !== null);
  const signal: Series = new Array(closes.length).fill(null);
  if (first >= 0) {
    const tail = signal
      .slice(0, first)
      .concat(ema(line.slice(first) as number[], signalPeriod));
    tail.forEach((value, i) => (signal[i] = value));
  }
  const histogram: Series = line.map((value, i) => {
    const s = signal[i];
    return value === null || s === null || s === undefined ? null : value - s;
  });
  return { line, signal, histogram };
}

export interface BollingerSeries {
  upper: Series;
  middle: Series;
  lower: Series;
}

/**
 * Bollinger(20, 2): middle = SMA20, σ = population deviation of the last
 * 20 closes, computed shifted by the window's first close so equal closes
 * give σ = 0 exactly (D-52).
 */
export function bollinger(
  closes: readonly number[],
  n = 20,
  width = 2,
): BollingerSeries {
  const middle = sma(closes, n);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  for (let i = n - 1; i < closes.length; i += 1) {
    const base = closes[i - n + 1] as number;
    let sum = 0;
    let squares = 0;
    for (let j = i - n + 1; j <= i; j += 1) {
      const shifted = (closes[j] as number) - base;
      sum += shifted;
      squares += shifted * shifted;
    }
    const mean = sum / n;
    const sigma = Math.sqrt(Math.max(squares / n - mean * mean, 0));
    const mid = middle[i] as number;
    upper[i] = mid + width * sigma;
    lower[i] = mid - width * sigma;
  }
  return { upper, middle, lower };
}
