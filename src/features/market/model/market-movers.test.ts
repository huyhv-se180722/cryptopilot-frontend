import { describe, expect, it } from 'vitest';
import type { MarketPair, MarketTicker } from '../../../types/domain';
import {
  RADAR_OUTER,
  breadth,
  byVolume,
  featuredPair,
  radarPoints,
  topMovers,
} from './market-movers';

const pair = (base: string, displayOrder: number): MarketPair => ({
  symbol: base + 'USDT',
  market: 'spot',
  baseAsset: base,
  quoteAsset: 'USDT',
  baseAssetName: null,
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder,
});
const ticker = (
  base: string,
  change: string | null,
  volume: string | null,
): MarketTicker => ({
  market: 'spot',
  symbol: base + 'USDT',
  sourceTime: '2026-10-14T00:00:00Z',
  lastPrice: '1',
  bestBid: null,
  bestAsk: null,
  high24h: null,
  low24h: null,
  changePercent24h: change,
  baseVolume24h: null,
  quoteVolume24h: volume,
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
});

const PAIRS = ['ADA', 'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK'].map(pair);
const TICKERS = new Map(
  [
    ticker('ADA', '-1.91', '36490000'),
    ticker('BTC', '0.87', '1320000000'),
    ticker('ETH', '-0.43', '766070000'),
    ticker('SOL', '4.20', '320320000'),
    ticker('XRP', '0.69', '165770000'),
    ticker('DOGE', '-3.10', '65280000'),
    ticker('LINK', null, '33780000'),
  ].map((each) => [each.symbol, each]),
);

describe('market movers (public home hero)', () => {
  it('features BTC/USDT, or the most traded pair without it', () => {
    expect(featuredPair(PAIRS, TICKERS)?.symbol).toBe('BTCUSDT');
    const noBtc = PAIRS.filter((each) => each.baseAsset !== 'BTC');
    expect(featuredPair(noBtc, TICKERS)?.symbol).toBe('ETHUSDT');
    expect(featuredPair(noBtc, new Map())?.symbol).toBe('ADAUSDT');
    expect(featuredPair([], TICKERS)).toBeNull();
  });

  it('ranks the most traded pairs by 24h quote volume, exactly', () => {
    expect(
      byVolume(PAIRS, TICKERS, 4).map((row) => row.pair.baseAsset),
    ).toEqual(['BTC', 'ETH', 'SOL', 'XRP']);
  });

  it('lists the largest rises and falls, never a falling pair as a gainer', () => {
    const { gainers, losers } = topMovers(PAIRS, TICKERS, 3);
    expect(gainers.map((row) => row.pair.baseAsset)).toEqual([
      'SOL',
      'BTC',
      'XRP',
    ]);
    expect(losers.map((row) => row.pair.baseAsset)).toEqual([
      'DOGE',
      'ADA',
      'ETH',
    ]);
    // Two rise and two fall: two of each, whatever the count asked.
    const few = topMovers(PAIRS.slice(0, 4), TICKERS, 3);
    expect(few.gainers.map((row) => row.pair.baseAsset)).toEqual([
      'SOL',
      'BTC',
    ]);
    expect(few.losers.map((row) => row.pair.baseAsset)).toEqual(['ADA', 'ETH']);
  });

  it('sums up the market: rising and falling pairs, their share, the volume', () => {
    expect(breadth(PAIRS, TICKERS)).toEqual({
      rising: 3,
      falling: 3,
      risingShare: 50,
      // 36,490,000 + 1,320,000,000 + … + 33,780,000, exactly.
      volume: '2707710000',
    });
    expect(breadth([], TICKERS)).toEqual({
      rising: 0,
      falling: 0,
      risingShare: null,
      volume: null,
    });
  });

  it('puts rising pairs right and falling pairs left, farther for bigger moves', () => {
    const { gainers, losers } = topMovers(PAIRS, TICKERS, 3);
    const points = radarPoints(gainers, losers);
    const at = (base: string) =>
      points.find((point) => point.pair.baseAsset === base)!;
    const reach = (base: string) =>
      Math.hypot(at(base).x - 50, at(base).y - 50) / 100;
    for (const point of points)
      expect(point.side === 'rising' ? point.x > 50 : point.x < 50).toBe(true);
    // SOL (+4.20 %) moved most: it sits farthest, inside the outer ring.
    expect(reach('SOL')).toBeCloseTo(RADAR_OUTER * 0.82, 5);
    expect(reach('BTC')).toBeLessThan(reach('SOL'));
    expect(reach('DOGE')).toBeGreaterThan(reach('ETH'));
    expect(radarPoints([], [])).toEqual([]);
  });
});
