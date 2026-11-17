import { describe, expect, it } from 'vitest';
import type { CoinMarketRow, MarketTicker } from '../../types/domain';
import {
  bullishShare,
  changePercent,
  coinView,
  compactUsd,
  formatUsd,
  sortCoins,
} from './coin-market';

const row = (over: Partial<CoinMarketRow> = {}): CoinMarketRow => ({
  symbol: 'BTC',
  name: 'Bitcoin',
  logoUrl: null,
  rank: 1,
  spotSymbol: 'BTCUSDT',
  futuresSymbol: 'BTCUSDT',
  circulatingSupply: '20000000',
  price1hAgo: '50000',
  price7dAgo: '40000',
  sparkline7d: [],
  ...over,
});

const ticker = (over: Partial<MarketTicker>): MarketTicker => ({
  market: 'spot',
  symbol: 'BTCUSDT',
  sourceTime: '2026-11-17T00:00:00Z',
  lastPrice: null,
  bestBid: null,
  bestAsk: null,
  high24h: null,
  low24h: null,
  changePercent24h: null,
  baseVolume24h: null,
  quoteVolume24h: null,
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
  ...over,
});

describe('coin market', () => {
  it('computes a change in percent from a past price', () => {
    expect(changePercent('51000', '50000')).toBe('2');
    expect(changePercent('49500', '50000')).toBe('-1');
    expect(changePercent('1', null)).toBeNull();
    expect(changePercent('1', '0')).toBeNull();
  });

  it('builds a row from the Spot ticker, with the market cap from the supply', () => {
    const view = coinView(
      row(),
      ticker({
        lastPrice: '50500',
        changePercent24h: '1.25',
        quoteVolume24h: '32000000000',
      }),
      undefined,
      { symbol: 'BTC', bullish: 3, bearish: 1 },
    );
    expect(view.price).toBe('50500');
    expect(view.change1h).toBe('1');
    expect(view.change7d).toBe('26.25');
    expect(view.change24h).toBe('1.25');
    expect(view.marketCap).toBe('1010000000000');
    expect(view.volume24h).toBe('32000000000');
    expect(view.href).toBe('/markets/spot/BTCUSDT');
    expect(bullishShare(view.sentiment)).toBe(0.75);
  });

  it('falls back to the Futures mark price for a coin only on Futures', () => {
    const view = coinView(
      row({ spotSymbol: null, futuresSymbol: 'PEPEUSDT' }),
      undefined,
      ticker({ market: 'futures', markPrice: '50000' }),
      null,
    );
    expect(view.price).toBe('50000');
    expect(view.href).toBe('/markets/futures/PEPEUSDT');
    expect(bullishShare(view.sentiment)).toBeNull();
  });

  it('formats dollars by size', () => {
    expect(formatUsd('64928.44')).toBe('$64,928.44');
    expect(formatUsd('0.99912')).toBe('$0.9991');
    expect(formatUsd('0.0000123456')).toBe('$0.00001235');
    expect(compactUsd('1306635910191')).toBe('$1.31T');
  });

  it('sorts by market cap, a missing value last', () => {
    const big = coinView(
      row(),
      ticker({ lastPrice: '50000' }),
      undefined,
      null,
    );
    const small = coinView(
      row({ symbol: 'ETH', name: 'Ethereum', rank: 2, circulatingSupply: '1' }),
      ticker({ lastPrice: '2000', changePercent24h: '5' }),
      undefined,
      null,
    );
    const none = coinView(
      row({ symbol: 'X', rank: 9 }),
      undefined,
      undefined,
      null,
    );
    expect(
      sortCoins([none, small, big], { key: 'rank', descending: false }).map(
        (v) => v.coin.symbol,
      ),
    ).toEqual(['BTC', 'ETH', 'X']);
    expect(
      sortCoins([big, none, small], { key: 'change24h', descending: true }).map(
        (v) => v.coin.symbol,
      ),
    ).toEqual(['ETH', 'BTC', 'X']);
  });
});
