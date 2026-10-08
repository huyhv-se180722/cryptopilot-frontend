import type { MarketFeed, MarketService } from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  Candle,
  MarketOverview,
  MarketTicker,
  MarketType,
} from '../types/domain';
import { devPairs, devStartPrice, devTickSize } from './fixtures/market';

/**
 * DEVELOPMENT ONLY. In-memory `/market/**` adapter and a simulated
 * overview feed (every 2 s, as the backend batches it). Prices follow a
 * seeded walk so screenshots and tests are stable; the simulation may use
 * numbers, the values it hands out are decimal strings like the API's.
 */

/** Mulberry32: a small deterministic generator. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const decimalsOf = (tickSize: string) => tickSize.split('.')[1]?.length ?? 0;
const DAY_MS = 86_400_000;
const FUNDING_MS = 8 * 3_600_000;

function notEnabled(): never {
  throw new ServiceError('Development pair not enabled.', 'HTTP_ERROR', 404, {
    status: 404,
    code: 'RESOURCE_NOT_FOUND',
    messageCode: 'MSG41',
    messageArgs: [],
    fieldErrors: {},
  });
}

export function createDevelopmentMarket(now: () => number = Date.now): {
  market: MarketService;
  marketFeed: MarketFeed;
} {
  const random = generator(31);
  const prices = new Map<string, number>();
  const opens = new Map<string, number>();
  const priceOf = (symbol: string) => {
    if (!prices.has(symbol)) {
      prices.set(symbol, devStartPrice(symbol));
      opens.set(symbol, devStartPrice(symbol) * 0.98);
    }
    return prices.get(symbol) as number;
  };
  const enabled = (market: MarketType, symbol: string) =>
    devPairs(market).some((pair) => pair.symbol === symbol.toUpperCase());

  function ticker(market: MarketType, symbol: string): MarketTicker {
    const price = priceOf(symbol);
    const places = decimalsOf(devTickSize(symbol));
    const fixed = (value: number) => value.toFixed(places);
    const open = opens.get(symbol) as number;
    const time = new Date(now()).toISOString();
    const base = {
      market,
      symbol,
      sourceTime: time,
      lastPrice: null,
      high24h: null,
      low24h: null,
      changePercent24h: null,
      quoteVolume24h: null,
      markPrice: null,
      indexPrice: null,
      fundingRate: null,
      nextFundingTime: null,
    };
    if (market === 'spot')
      return {
        ...base,
        lastPrice: fixed(price),
        high24h: fixed(Math.max(price, open) * 1.012),
        low24h: fixed(Math.min(price, open) * 0.988),
        changePercent24h: (((price - open) / open) * 100).toFixed(3),
        quoteVolume24h: (price * 18_234.11).toFixed(2),
      };
    return {
      ...base,
      markPrice: fixed(price * 1.0002),
      indexPrice: fixed(price),
      fundingRate: '0.00010000',
      nextFundingTime: new Date(
        Math.ceil(now() / FUNDING_MS) * FUNDING_MS,
      ).toISOString(),
    };
  }

  function step() {
    for (const symbol of prices.keys())
      prices.set(symbol, priceOf(symbol) * (1 + (random() - 0.5) * 0.004));
  }

  const market: MarketService = {
    async listPairs(marketType, signal) {
      signal?.throwIfAborted();
      return devPairs(marketType);
    },
    async getCandles({ market: marketType, symbol, limit, signal }) {
      signal?.throwIfAborted();
      if (!enabled(marketType, symbol)) notEnabled();
      const walk = generator(symbol.length * 7919);
      const places = decimalsOf(devTickSize(symbol.toUpperCase()));
      const today = Math.floor(now() / DAY_MS) * DAY_MS;
      let close = devStartPrice(symbol.toUpperCase()) * 0.8;
      const candles: Candle[] = [];
      for (let i = limit; i >= 1; i -= 1) {
        const open = close;
        close = open * (1 + (walk() - 0.48) * 0.05);
        const high = Math.max(open, close) * (1 + walk() * 0.02);
        const low = Math.min(open, close) * (1 - walk() * 0.02);
        candles.push({
          openTime: new Date(today - i * DAY_MS).toISOString(),
          open: open.toFixed(places),
          high: high.toFixed(places),
          low: low.toFixed(places),
          close: close.toFixed(places),
          quoteVolume: (close * (5_000 + walk() * 5_000)).toFixed(2),
        });
      }
      return candles;
    },
    async getTicker(marketType, symbol, signal) {
      signal?.throwIfAborted();
      if (!enabled(marketType, symbol)) notEnabled();
      return ticker(marketType, symbol.toUpperCase());
    },
  };

  const listeners = new Map<
    MarketType,
    Set<(overview: MarketOverview) => void>
  >();
  let timer: ReturnType<typeof setInterval> | undefined;
  const publish = () => {
    step();
    for (const [marketType, set] of listeners) {
      const overview: MarketOverview = {
        market: marketType,
        serverTime: new Date(now()).toISOString(),
        tickers: devPairs(marketType).map((pair) =>
          ticker(marketType, pair.symbol),
        ),
      };
      set.forEach((listener) => listener(overview));
    }
  };

  const marketFeed: MarketFeed = {
    status: () => 'open',
    onStatus: () => () => undefined,
    subscribeOverview(marketType, listener) {
      let set = listeners.get(marketType);
      if (!set) {
        set = new Set();
        listeners.set(marketType, set);
      }
      set.add(listener);
      timer ??= setInterval(publish, 2_000);
      queueMicrotask(publish);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(marketType);
        if (listeners.size === 0 && timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };

  return { market, marketFeed };
}
