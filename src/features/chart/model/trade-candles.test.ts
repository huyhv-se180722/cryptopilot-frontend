import { describe, expect, it } from 'vitest';
import { decodeChartCandles } from '../../../services/api/market-dto';
import type { Candle, MarketTrade } from '../../../types/domain';
import {
  candleOpen,
  chartTimeframesOf,
  isStoredTimeframe,
} from '../../../utils/chart-timeframe';
import { foldTrades, newestForming } from './trade-candles';

const at = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

describe('chart timeframes (TR-35)', () => {
  it('opens weeks on Monday, months on the 1st and 3d from the epoch', () => {
    // 2026-11-26 is a Thursday.
    expect(iso(candleOpen(at('2026-11-26T10:00:00Z'), '1w'))).toBe(
      '2026-11-23T00:00:00.000Z',
    );
    expect(iso(candleOpen(at('2026-11-26T10:00:00Z'), '1M'))).toBe(
      '2026-11-01T00:00:00.000Z',
    );
    expect(
      candleOpen(at('2026-11-26T10:00:00Z'), '3d') % (3 * 86_400_000),
    ).toBe(0);
    expect(iso(candleOpen(at('2026-11-26T10:07:59Z'), '5m'))).toBe(
      '2026-11-26T10:05:00.000Z',
    );
  });

  it('offers 1s on Spot only and knows the four stored ones', () => {
    expect(chartTimeframesOf('spot')).toHaveLength(16);
    expect(chartTimeframesOf('futures')).not.toContain('1s');
    expect(isStoredTimeframe('4h')).toBe(true);
    expect(isStoredTimeframe('5m')).toBe(false);
  });
});

const trade = (time: string, price: string, quantity = '1'): MarketTrade => ({
  id: Date.parse(time),
  price,
  quantity,
  time,
  buyerMaker: false,
});

describe('trades folded into candles', () => {
  it('moves the forming candle, then opens the next one at its trade', () => {
    const start = { closed: [], forming: null };
    const one = foldTrades(
      start,
      [
        trade('2026-11-26T10:00:01Z', '100'),
        trade('2026-11-26T10:00:20Z', '103', '2'),
        trade('2026-11-26T10:00:40Z', '99'),
      ],
      '1m',
    );
    expect(one.forming).toEqual({
      openTime: '2026-11-26T10:00:00.000Z',
      open: '100',
      high: '103',
      low: '99',
      close: '99',
      baseVolume: '4',
      quoteVolume: '405',
    });
    const two = foldTrades(one, [trade('2026-11-26T10:01:05Z', '101')], '1m');
    expect(two.closed).toEqual([one.forming]);
    expect(two.forming?.openTime).toBe('2026-11-26T10:01:00.000Z');
    expect(two.forming?.open).toBe('101');
  });

  it('drops a trade older than the forming candle and keeps the state', () => {
    const state = foldTrades(
      { closed: [], forming: null },
      [trade('2026-11-26T10:05:00Z', '100')],
      '5m',
    );
    expect(foldTrades(state, [trade('2026-11-26T10:04:59Z', '90')], '5m')).toBe(
      state,
    );
  });
});

describe('chart candles decoder', () => {
  const candle = (openTime: string, closed: boolean) => ({
    openTime,
    closeTime: openTime,
    open: '1',
    high: '2',
    low: '0.5',
    close: '1.5',
    baseVolume: '10',
    quoteVolume: '15',
    tradeCount: 3,
    closed,
  });

  it('keeps the last unclosed candle apart as the forming one', () => {
    const page = decodeChartCandles({
      symbol: 'BTCUSDT',
      market: 'SPOT',
      timeframe: '5m',
      source: 'EXCHANGE',
      candles: [
        candle('2026-11-26T10:00:00Z', true),
        candle('2026-11-26T10:05:00Z', false),
      ],
    });
    expect(page.candles).toHaveLength(1);
    expect(page.forming?.openTime).toBe('2026-11-26T10:05:00Z');
  });

  it('reads a page of closed candles without a forming one', () => {
    const page = decodeChartCandles({
      candles: [candle('2026-11-26T10:00:00Z', true)],
    });
    expect(page.forming).toBe(null);
  });
});

describe('forming candle of the page and of the trades', () => {
  const candle = (patch: Partial<Candle>): Candle => ({
    openTime: '2026-11-01T00:00:00.000Z',
    open: '78000',
    high: '80000',
    low: '60500',
    close: '60700',
    baseVolume: '100',
    quoteVolume: '7000000',
    ...patch,
  });

  it('keeps the exchange open when the trades opened the same candle first', () => {
    const page = candle({});
    const live = candle({
      open: '60731',
      high: '60740',
      low: '60400',
      close: '60735',
      baseVolume: '2',
      quoteVolume: '121000',
    });
    expect(newestForming(live, page)).toEqual({
      ...page,
      low: '60400',
      close: '60735',
    });
  });

  it('takes the later candle when they open apart', () => {
    const page = candle({});
    const live = candle({ openTime: '2026-12-01T00:00:00.000Z' });
    expect(newestForming(live, page)).toBe(live);
    expect(newestForming(null, page)).toBe(page);
  });
});
