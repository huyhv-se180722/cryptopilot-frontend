import type {
  Candle,
  MarketOverview,
  MarketPair,
  MarketTicker,
  MarketType,
} from '../../types/domain';
import {
  decimal,
  instant,
  integer,
  list,
  nullableDecimal,
  nullableInstant,
  nullableText,
  record,
  text,
} from './decode';

/**
 * Decoders for the `/market/**` responses and the overview topic
 * (SRS 3.3.1, checked against `develop` @ 0d92def). The wire spells the
 * market `SPOT` / `FUTURES`; the client model uses `spot` / `futures`.
 */
export function marketOf(value: unknown, name = 'market'): MarketType {
  if (value === 'SPOT') return 'spot';
  if (value === 'FUTURES') return 'futures';
  throw new Error(name + ' is not SPOT or FUTURES');
}

export interface PairPage {
  items: readonly MarketPair[];
  total: number;
}

export function decodePairPage(body: unknown): PairPage {
  const value = record(body);
  return {
    items: list(value.items, 'items').map((item, index) => {
      const pair = record(item, 'items[' + index + ']');
      return {
        symbol: text(pair.symbol, 'symbol'),
        market: marketOf(pair.market),
        baseAsset: nullableText(pair.baseAsset, 'baseAsset'),
        quoteAsset: nullableText(pair.quoteAsset, 'quoteAsset'),
        baseAssetName: nullableText(pair.baseAssetName, 'baseAssetName'),
        logoUrl: nullableText(pair.logoUrl, 'logoUrl'),
        tickSize: nullableDecimal(pair.tickSize, 'tickSize'),
        displayOrder: integer(pair.displayOrder, 'displayOrder'),
      };
    }),
    total: integer(value.total, 'total'),
  };
}

export function decodeCandles(body: unknown): readonly Candle[] {
  const value = record(body);
  return list(value.candles, 'candles').map((item, index) => {
    const candle = record(item, 'candles[' + index + ']');
    return {
      openTime: instant(candle.openTime, 'openTime'),
      open: decimal(candle.open, 'open'),
      high: decimal(candle.high, 'high'),
      low: decimal(candle.low, 'low'),
      close: decimal(candle.close, 'close'),
      quoteVolume: decimal(candle.quoteVolume, 'quoteVolume'),
    };
  });
}

/** One ticker of the stream (`/topic/ticker.*` and each overview item). */
export function decodeTicker(body: unknown): MarketTicker {
  const value = record(body, 'ticker');
  return {
    market: marketOf(value.market),
    symbol: text(value.symbol, 'symbol'),
    sourceTime: instant(value.sourceTime, 'sourceTime'),
    lastPrice: nullableDecimal(value.lastPrice, 'lastPrice'),
    high24h: nullableDecimal(value.high24h, 'high24h'),
    low24h: nullableDecimal(value.low24h, 'low24h'),
    changePercent24h: nullableDecimal(
      value.changePercent24h,
      'changePercent24h',
    ),
    quoteVolume24h: nullableDecimal(value.quoteVolume24h, 'quoteVolume24h'),
    markPrice: nullableDecimal(value.markPrice, 'markPrice'),
    indexPrice: nullableDecimal(value.indexPrice, 'indexPrice'),
    fundingRate: nullableDecimal(value.fundingRate, 'fundingRate'),
    nextFundingTime: nullableInstant(value.nextFundingTime, 'nextFundingTime'),
  };
}

export function decodeOverview(body: unknown): MarketOverview {
  const value = record(body, 'overview');
  return {
    market: marketOf(value.market),
    serverTime: instant(value.serverTime, 'serverTime'),
    tickers: list(value.tickers, 'tickers').map(decodeTicker),
  };
}

const absent = {
  lastPrice: null,
  high24h: null,
  low24h: null,
  changePercent24h: null,
  quoteVolume24h: null,
  markPrice: null,
  indexPrice: null,
  fundingRate: null,
  nextFundingTime: null,
} as const;

/** `GET /market/spot/{symbol}/stats`: the stored ticker, or null. */
export function decodeSpotStats(body: unknown): MarketTicker | null {
  const value = record(body);
  if (value.ticker === null || value.ticker === undefined) return null;
  const ticker = record(value.ticker, 'ticker');
  return {
    ...absent,
    market: 'spot',
    symbol: text(value.symbol, 'symbol'),
    sourceTime: instant(ticker.asOf, 'asOf'),
    lastPrice: nullableDecimal(ticker.lastPrice, 'lastPrice'),
    high24h: nullableDecimal(ticker.high24h, 'high24h'),
    low24h: nullableDecimal(ticker.low24h, 'low24h'),
    changePercent24h: nullableDecimal(
      ticker.changePercent24h,
      'changePercent24h',
    ),
    quoteVolume24h: nullableDecimal(ticker.quoteVolume24h, 'quoteVolume24h'),
  };
}

/** `GET /market/futures/{symbol}/stats`: the stored price block, or null. */
export function decodeFuturesStats(body: unknown): MarketTicker | null {
  const value = record(body);
  if (value.price === null || value.price === undefined) return null;
  const price = record(value.price, 'price');
  return {
    ...absent,
    market: 'futures',
    symbol: text(value.symbol, 'symbol'),
    sourceTime: instant(price.asOf, 'asOf'),
    markPrice: nullableDecimal(price.markPrice, 'markPrice'),
    indexPrice: nullableDecimal(price.indexPrice, 'indexPrice'),
    fundingRate: nullableDecimal(price.fundingRate, 'fundingRate'),
    nextFundingTime: nullableInstant(price.nextFundingTime, 'nextFundingTime'),
  };
}
