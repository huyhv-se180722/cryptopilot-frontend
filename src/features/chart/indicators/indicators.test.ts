import { describe, expect, it } from 'vitest';
import golden from './btcusdt-1h-talib.csv?raw';
import { bollinger, ema, macd, rsi, sma, type Series } from './indicators';

/**
 * The backend's golden data (Binance BTCUSDT 1h, TA-Lib 0.8.1; MACD built
 * from TA-Lib EMAs as D-52 says): the first 400 of its 1,200 candles. A
 * value at candle i depends only on candles 0…i, so the cut is exact.
 */
const rows = golden
  .trim()
  .split('\n')
  .slice(1)
  .map((line) =>
    line.split(',').map((cell) => (cell === '' ? null : Number(cell))),
  );
const column = (index: number) => rows.map((row) => row[index] ?? null);
const closes = column(1) as number[];
const volumes = column(2) as number[];

/** D-52 tolerance: max(1e-8·|expected|, 1e-8). */
function expectSeries(actual: Series, expected: Series) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((value, i) => {
    if (value === null) {
      expect(actual[i], 'index ' + i).toBeNull();
      return;
    }
    const got = actual[i];
    expect(got, 'index ' + i).not.toBeNull();
    expect(Math.abs((got as number) - value), 'index ' + i).toBeLessThanOrEqual(
      Math.max(1e-8 * Math.abs(value), 1e-8),
    );
  });
}

describe('indicators against the golden data (BR-12, TECHNICAL_DESIGN 7.2)', () => {
  it('SMA20 and the volume SMA20', () => {
    expectSeries(sma(closes, 20), column(3));
    expectSeries(sma(volumes, 20), column(14));
  });
  it('EMA20, EMA50 and EMA200 seeded with the SMA', () => {
    expectSeries(ema(closes, 20), column(4));
    expectSeries(ema(closes, 50), column(5));
    expectSeries(ema(closes, 200), column(6));
  });
  it('RSI14 with Wilder smoothing', () => {
    expectSeries(rsi(closes), column(7));
  });
  it('MACD(12, 26, 9) as D-52', () => {
    const result = macd(closes);
    expectSeries(result.line, column(8));
    expectSeries(result.signal, column(9));
    expectSeries(result.histogram, column(10));
  });
  it('Bollinger(20, 2) with the population deviation', () => {
    const bands = bollinger(closes);
    expectSeries(bands.upper, column(11));
    expectSeries(bands.middle, column(12));
    expectSeries(bands.lower, column(13));
  });
});

describe('indicator edge cases', () => {
  it('RSI is 50 on a flat seed (D-55), 100 without losses, 0 without gains', () => {
    const flat = new Array(20).fill(5);
    expect(rsi(flat)[14]).toBe(50);
    expect(rsi(Array.from({ length: 16 }, (_, i) => i))[15]).toBe(100);
    expect(rsi(Array.from({ length: 16 }, (_, i) => 20 - i))[15]).toBe(0);
  });
  it('equal closes give bands equal to the middle', () => {
    const bands = bollinger(new Array(25).fill(1.1));
    expect(bands.upper[24]).toBe(bands.middle[24]);
    expect(bands.lower[24]).toBe(bands.middle[24]);
  });
  it('stays null while the seed is incomplete', () => {
    expect(ema([1, 2], 3)).toEqual([null, null]);
    expect(macd([1, 2, 3]).signal).toEqual([null, null, null]);
  });
});
