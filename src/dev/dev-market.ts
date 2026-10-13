import type {
  AnalysisService,
  MarketFeed,
  MarketService,
  TradingMarketService,
} from '../services/api/contracts';
import { ServiceError } from '../services/api/errors';
import type {
  Candle,
  CandleTimeframe,
  FuturesMetrics,
  KlineUpdate,
  MarketOverview,
  MarketTicker,
  MarketTrade,
  MarketType,
  OrderBook,
  OrderBookLevel,
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
const TIMEFRAME_MS: Record<CandleTimeframe, number> = {
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': DAY_MS,
};
const FUNDING_MS = 8 * 3_600_000;
const METRIC_MS = 300_000;
/** Pairs whose metrics start two days ago, to show the available period. */
const RECENT_METRICS = new Set(['SOLUSDT', 'XRPUSDT']);

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
  analysis: AnalysisService;
  tradingMarket: TradingMarketService;
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
    };
    if (market === 'spot')
      return {
        ...base,
        lastPrice: fixed(price),
        bestBid: fixed(price * 0.9999),
        bestAsk: fixed(price * 1.0001),
        high24h: fixed(Math.max(price, open) * 1.012),
        low24h: fixed(Math.min(price, open) * 0.988),
        changePercent24h: (((price - open) / open) * 100).toFixed(3),
        baseVolume24h: '18234.11000000',
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
    async getCandles({
      market: marketType,
      symbol,
      timeframe,
      limit,
      before,
      signal,
    }) {
      signal?.throwIfAborted();
      if (!enabled(marketType, symbol)) notEnabled();
      const step = TIMEFRAME_MS[timeframe];
      const places = decimalsOf(devTickSize(symbol.toUpperCase()));
      const seed = symbol.length * 7919;
      // Price is a fixed function of the candle index, so an earlier page
      // (`before`) joins the later one; scaled so the latest closed candle
      // meets the live price.
      const level = (k: number) =>
        Math.exp(
          0.14 * Math.sin(k / 47 + seed) +
            0.06 * Math.sin(k / 13) +
            0.012 * (generator(seed + k)() - 0.5),
        );
      const latest = Math.floor(now() / step) - 1;
      const scale = priceOf(symbol.toUpperCase()) / level(latest);
      const last = before ? Math.ceil(Date.parse(before) / step) - 1 : latest;
      const candles: Candle[] = [];
      for (let k = last - limit + 1; k <= last; k += 1) {
        const open = level(k - 1) * scale;
        const close = level(k) * scale;
        const wick = generator(seed * 31 + k);
        candles.push({
          openTime: new Date(k * step).toISOString(),
          open: open.toFixed(places),
          high: (Math.max(open, close) * (1 + wick() * 0.006)).toFixed(places),
          low: (Math.min(open, close) * (1 - wick() * 0.006)).toFixed(places),
          close: close.toFixed(places),
          baseVolume: (7_500 * (0.6 + wick() * 0.8)).toFixed(4),
          quoteVolume: (close * 7_500).toFixed(2),
        });
      }
      return candles;
    },
    async getTicker(marketType, symbol, signal) {
      signal?.throwIfAborted();
      if (!enabled(marketType, symbol)) notEnabled();
      return ticker(marketType, symbol.toUpperCase());
    },
    /**
     * Sparse 5-minute points (about one in twenty missing) and an 8-hour
     * settlement, scripted from a seeded walk; not market data.
     */
    async getFuturesMetrics(symbol, from, signal) {
      signal?.throwIfAborted();
      const pair = symbol.toUpperCase();
      if (!enabled('futures', pair)) notEnabled();
      const to = now();
      const stored =
        Math.floor(to / METRIC_MS) * METRIC_MS -
        (RECENT_METRICS.has(pair) ? 2 : 30) * DAY_MS;
      const walk = generator(pair.length * 104_729);
      const price = priceOf(pair);
      const first =
        Math.ceil(Math.max(Date.parse(from), stored) / METRIC_MS) * METRIC_MS;
      const openInterest: FuturesMetrics['openInterest'][number][] = [];
      const longShortRatio: FuturesMetrics['longShortRatio'][number][] = [];
      let contracts = 5_000_000_000 / price;
      let longs = 0.62;
      for (let time = first; time < to; time += METRIC_MS) {
        contracts *= 1 + (walk() - 0.5) * 0.004;
        longs = Math.min(0.75, Math.max(0.4, longs + (walk() - 0.5) * 0.006));
        if (walk() < 0.05) continue;
        const instant = new Date(time).toISOString();
        openInterest.push({
          time: instant,
          openInterest: contracts.toFixed(3),
          openInterestValue: (contracts * price).toFixed(2),
        });
        longShortRatio.push({
          time: instant,
          longShortRatio: (longs / (1 - longs)).toFixed(4),
          longAccountRatio: longs.toFixed(4),
          shortAccountRatio: (1 - longs).toFixed(4),
        });
      }
      const fundingSettlements: FuturesMetrics['fundingSettlements'][number][] =
        [];
      for (
        let time = Math.ceil(first / FUNDING_MS) * FUNDING_MS;
        time < to;
        time += FUNDING_MS
      )
        fundingSettlements.push({
          fundingTime: new Date(time).toISOString(),
          fundingRate: ((walk() - 0.3) * 0.0002).toFixed(8),
          markPrice: price.toFixed(decimalsOf(devTickSize(pair))),
        });
      const since = new Date(stored).toISOString();
      return {
        symbol: pair,
        from,
        to: new Date(to).toISOString(),
        openInterest,
        longShortRatio,
        fundingSettlements,
        availableFrom: {
          openInterest: since,
          longShortRatio: since,
          fundingSettlements: since,
        },
      };
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

  const klineListeners = new Set<{
    market: MarketType;
    symbol: string;
    timeframe: CandleTimeframe;
    listener: (update: KlineUpdate) => void;
    open: number;
  }>();
  let klineTimer: ReturnType<typeof setInterval> | undefined;
  /** The forming candle of each followed series, moving with the price. */
  const publishKlines = () => {
    step();
    for (const entry of klineListeners) {
      const price = priceOf(entry.symbol);
      const places = decimalsOf(devTickSize(entry.symbol));
      const span = TIMEFRAME_MS[entry.timeframe];
      const openTime = Math.floor(now() / span) * span;
      entry.open ||= price;
      entry.listener({
        market: entry.market,
        symbol: entry.symbol,
        timeframe: entry.timeframe,
        closed: false,
        candle: {
          openTime: new Date(openTime).toISOString(),
          open: entry.open.toFixed(places),
          high: (Math.max(entry.open, price) * 1.001).toFixed(places),
          low: (Math.min(entry.open, price) * 0.999).toFixed(places),
          close: price.toFixed(places),
          baseVolume: (1_200 + random() * 400).toFixed(4),
          quoteVolume: (price * 1_200).toFixed(2),
        },
      });
    }
  };

  const tickerListeners = new Set<{
    market: MarketType;
    symbol: string;
    listener: (ticker: MarketTicker) => void;
  }>();
  let tickerTimer: ReturnType<typeof setInterval> | undefined;
  const publishTickers = () => {
    step();
    for (const entry of tickerListeners)
      entry.listener(ticker(entry.market, entry.symbol));
  };

  /**
   * Scripted results, not a re-implementation of BR-13 / BR-14: a score per
   * pair, levels a few percent around the price, null indicators on 1d to
   * show "Insufficient data".
   */
  const analysis: AnalysisService = {
    async get(marketType, symbol, timeframe, signal) {
      signal?.throwIfAborted();
      const pair = symbol.toUpperCase();
      if (!enabled(marketType, pair)) notEnabled();
      const price = priceOf(pair);
      const places = decimalsOf(devTickSize(pair));
      const fixed = (value: number) => value.toFixed(places);
      const short = timeframe === '1d';
      const score = (pair.charCodeAt(0) * 7) % 101;
      const value = (number: number) => (short ? null : fixed(number));
      const futures = marketType === 'futures';
      return {
        symbol: pair,
        market: marketType,
        timeframe,
        openTime: new Date(now() - 3_600_000).toISOString(),
        indicators: {
          sma20: value(price * 0.995),
          ema20: value(price * 0.996),
          ema50: value(price * 0.985),
          ema200: value(price * 0.94),
          rsi14: short ? null : '58.4',
          macdLine: short ? null : '12.5',
          macdSignal: short ? null : '9.1',
          macdHistogram: short ? null : '3.4',
          bbUpper: value(price * 1.02),
          bbMiddle: value(price * 0.995),
          bbLower: value(price * 0.97),
          volumeSma20: short ? null : '7500',
        },
        nearestSupport: fixed(price * 0.97),
        nearestResistance: fixed(price * 1.035),
        setupScore: {
          score: short ? null : score,
          preset: 'DAY_TRADING',
          presetVersion: 'v1',
          timeframe: '1h',
          openTime: new Date(now() - 3_600_000).toISOString(),
          components: {
            formulaVersion: 'v1',
            trend: short ? null : '75.00',
            momentum: short ? null : '60.00',
            volume: short ? null : '55.00',
            level: short ? null : '40.00',
            ...(futures ? { derivatives: short ? null : '50.00' } : {}),
          },
          ...(futures
            ? { dominantSide: short ? null : score >= 50 ? 'LONG' : 'SHORT' }
            : {}),
        },
      };
    },
  };

  const marketFeed: MarketFeed = {
    subscribeTicker(marketType, symbol, listener) {
      const entry = {
        market: marketType,
        symbol: symbol.toUpperCase(),
        listener,
      };
      tickerListeners.add(entry);
      tickerTimer ??= setInterval(publishTickers, 1_000);
      queueMicrotask(publishTickers);
      return () => {
        tickerListeners.delete(entry);
        if (tickerListeners.size === 0 && tickerTimer !== undefined) {
          clearInterval(tickerTimer);
          tickerTimer = undefined;
        }
      };
    },
    subscribeKline(marketType, symbol, timeframe, listener) {
      const entry = {
        market: marketType,
        symbol: symbol.toUpperCase(),
        timeframe,
        listener,
        open: 0,
      };
      klineListeners.add(entry);
      klineTimer ??= setInterval(publishKlines, 2_000);
      queueMicrotask(publishKlines);
      return () => {
        klineListeners.delete(entry);
        if (klineListeners.size === 0 && klineTimer !== undefined) {
          clearInterval(klineTimer);
          klineTimer = undefined;
        }
      };
    },
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

  /**
   * Depth and trades (TR-03) around the moving price: 20 levels a side a
   * few ticks apart, a new book every 300 ms (the exchange sends depth20
   * every 100 ms), and 0–3 trades every 250 ms. Quantities are larger for
   * cheaper coins so totals look alike.
   */
  let updateId = 1_000;
  let tradeId = 5_000;
  function book(marketType: MarketType, symbol: string): OrderBook {
    const price = priceOf(symbol);
    const tick = Number(devTickSize(symbol));
    const places = decimalsOf(devTickSize(symbol));
    const unit = Math.max(1, 60_000 / price) ** 0.7;
    const side = (direction: 1 | -1): OrderBookLevel[] => {
      const levels: OrderBookLevel[] = [];
      let level = Math.round(price / tick) * tick + direction * tick;
      for (let i = 0; i < 20; i += 1) {
        levels.push({
          price: level.toFixed(places),
          quantity: ((random() ** 2 * 2.5 + 0.002) * unit).toFixed(5),
        });
        level += direction * tick * (1 + Math.floor(random() * 3));
      }
      return levels;
    };
    updateId += 1;
    return {
      market: marketType,
      symbol,
      lastUpdateId: updateId,
      receivedAt: new Date(now()).toISOString(),
      bids: side(-1),
      asks: side(1),
    };
  }
  function trades(symbol: string, count: number): MarketTrade[] {
    const price = priceOf(symbol);
    const tick = Number(devTickSize(symbol));
    const places = decimalsOf(devTickSize(symbol));
    const unit = Math.max(1, 60_000 / price) ** 0.7;
    return Array.from({ length: count }, () => {
      const buyerMaker = random() < 0.5;
      tradeId += 1;
      return {
        id: tradeId,
        price: (
          Math.round(price / tick) * tick +
          (buyerMaker ? -1 : 1) * tick * Math.floor(random() * 2)
        ).toFixed(places),
        quantity: ((random() ** 3 * 1.5 + 0.0005) * unit).toFixed(5),
        time: new Date(now()).toISOString(),
        buyerMaker,
      };
    });
  }
  const depthListeners = new Set<{
    market: MarketType;
    symbol: string;
    listener: (book: OrderBook) => void;
  }>();
  const tradeListeners = new Set<{
    market: MarketType;
    symbol: string;
    listener: (trades: readonly MarketTrade[]) => void;
  }>();
  let depthTimer: ReturnType<typeof setInterval> | undefined;
  let tradeTimer: ReturnType<typeof setInterval> | undefined;
  const follow = <T extends { market: MarketType; symbol: string }>(
    set: Set<T>,
    entry: T,
    start: () => void,
    stop: () => void,
  ) => {
    if (!enabled(entry.market, entry.symbol)) return () => undefined;
    set.add(entry);
    start();
    return () => {
      set.delete(entry);
      if (set.size === 0) stop();
    };
  };
  const tradingMarket: TradingMarketService = {
    async getDepth(marketType, symbol, signal) {
      signal?.throwIfAborted();
      if (!enabled(marketType, symbol)) notEnabled();
      return book(marketType, symbol.toUpperCase());
    },
    async getTrades(marketType, symbol, limit, signal) {
      signal?.throwIfAborted();
      if (!enabled(marketType, symbol)) notEnabled();
      return trades(symbol.toUpperCase(), limit).reverse();
    },
    subscribeDepth(marketType, symbol, listener) {
      return follow(
        depthListeners,
        { market: marketType, symbol: symbol.toUpperCase(), listener },
        () =>
          (depthTimer ??= setInterval(() => {
            step();
            for (const entry of depthListeners)
              entry.listener(book(entry.market, entry.symbol));
          }, 300)),
        () => {
          clearInterval(depthTimer);
          depthTimer = undefined;
        },
      );
    },
    subscribeTrades(marketType, symbol, listener) {
      return follow(
        tradeListeners,
        { market: marketType, symbol: symbol.toUpperCase(), listener },
        () =>
          (tradeTimer ??= setInterval(() => {
            for (const entry of tradeListeners) {
              const count = Math.floor(random() * 4);
              if (count > 0) entry.listener(trades(entry.symbol, count));
            }
          }, 250)),
        () => {
          clearInterval(tradeTimer);
          tradeTimer = undefined;
        },
      );
    },
  };

  return { market, marketFeed, analysis, tradingMarket };
}
