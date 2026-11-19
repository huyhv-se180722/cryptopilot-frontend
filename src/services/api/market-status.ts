import type { Decimal } from '../../types/domain';
import type { StompTopics } from '../websocket/stomp-market-feed';
import {
  flag,
  instant,
  integer,
  list,
  nullableDecimal,
  nullableInstant,
  nullableText,
  oneOf,
  record,
  text,
  decimal,
} from './decode';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

/** The two exchange markets whose data health is watched (D-158). */
export type HealthMarket = 'SPOT' | 'FUTURES';

/**
 * A market's data health: live, reconnecting (short loss, still tradable),
 * paused (data lost, trading closed), recovering (data back, catching up,
 * still closed) or under maintenance by an administrator.
 */
export type MarketHealthState =
  'LIVE' | 'RECONNECTING' | 'PAUSED' | 'RECOVERING' | 'MAINTENANCE';

export type IncidentReason =
  | 'STREAM_LOST'
  | 'REST_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'IP_BANNED'
  | 'MAINTENANCE';

/** Where the prices a market's screens show come from now. */
export type DisplaySource = 'BINANCE' | 'OKX' | 'NONE';

export interface MarketHealth {
  market: HealthMarket;
  state: MarketHealthState;
  tradingOpen: boolean;
  /** When the data was last live, while closed. */
  since: string | null;
  pausedAt: string | null;
  reason: IncidentReason | null;
  /** The administrator's message of a maintenance. */
  message: string | null;
  incidentId: string | null;
  /** When trading reopened, for ten minutes after an incident. */
  resumedAt: string | null;
  /** Symbols whose data is lost while the market is open (their forms lock). */
  pausedPairs: readonly string[];
  expectedEndAt: string | null;
  /** When the exchange takes the server's calls again (a ban). */
  retryAt: string | null;
  recovery: { pairsDone: number; pairsTotal: number } | null;
  displaySource: DisplaySource;
}

export interface MarketStatus {
  markets: readonly MarketHealth[];
}

export interface FallbackPrice {
  symbol: string;
  lastPrice: Decimal;
  changePercent24h: Decimal | null;
  high24h: Decimal | null;
  low24h: Decimal | null;
  volume24h: Decimal | null;
  asOf: string | null;
  /** Further from the exchange's last price than allowed: warn. */
  diverged: boolean;
}

export interface FallbackPrices {
  market: HealthMarket;
  source: DisplaySource;
  asOf: string | null;
  prices: readonly FallbackPrice[];
}

export interface MarketIncident {
  id: string;
  market: HealthMarket;
  kind: 'OUTAGE' | 'MAINTENANCE';
  reason: IncidentReason;
  lastLiveAt: string;
  pausedAt: string;
  recoveryStartedAt: string | null;
  resumedAt: string | null;
  message: string | null;
  createdBy: string | null;
  expectedEndAt: string | null;
}

export interface MaintenanceInput {
  market: HealthMarket;
  on: boolean;
  message?: string;
  expectedEndAt?: string;
}

/**
 * The markets' data health (D-158): the status every screen reads, pushed on
 * `/topic/market.status`; the display-only reference prices of a lost market,
 * pushed on `/topic/market.fallback.<MARKET>`; and the administrators'
 * maintenance switch, reopening and incident list.
 */
export interface MarketStatusService {
  status(signal?: AbortSignal): Promise<MarketStatus>;
  /** Pushes of the status; a no-op without the public feed. */
  subscribe(listener: (status: MarketStatus) => void): () => void;
  fallback(market: HealthMarket, signal?: AbortSignal): Promise<FallbackPrices>;
  subscribeFallback(
    market: HealthMarket,
    listener: (prices: FallbackPrices) => void,
  ): () => void;
  maintenance(input: MaintenanceInput): Promise<MarketStatus>;
  resume(market: HealthMarket): Promise<MarketStatus>;
  incidents(
    market: HealthMarket,
    limit: number,
    signal?: AbortSignal,
  ): Promise<MarketIncident[]>;
}

const MARKETS: readonly HealthMarket[] = ['SPOT', 'FUTURES'];
const STATES: readonly MarketHealthState[] = [
  'LIVE',
  'RECONNECTING',
  'PAUSED',
  'RECOVERING',
  'MAINTENANCE',
];
const REASONS: readonly IncidentReason[] = [
  'STREAM_LOST',
  'REST_UNAVAILABLE',
  'RATE_LIMITED',
  'IP_BANNED',
  'MAINTENANCE',
];
const SOURCES: readonly DisplaySource[] = ['BINANCE', 'OKX', 'NONE'];

export const STATUS_TOPIC = '/topic/market.status';
export const fallbackTopic = (market: HealthMarket) =>
  '/topic/market.fallback.' + market;

/** `MarketHealthResponse`, checked against backend feat/market-outage-pause. */
export function decodeMarketHealth(body: unknown): MarketHealth {
  const value = record(body, 'market');
  const recovery =
    value.recovery === null || value.recovery === undefined
      ? null
      : record(value.recovery, 'recovery');
  const reason = value.reason;
  return {
    market: oneOf(MARKETS, value.market, 'market'),
    state: oneOf(STATES, value.state, 'state'),
    tradingOpen: flag(value.tradingOpen, 'tradingOpen'),
    since: nullableInstant(value.since, 'since'),
    pausedAt: nullableInstant(value.pausedAt, 'pausedAt'),
    reason:
      reason === null || reason === undefined
        ? null
        : oneOf(REASONS, reason, 'reason'),
    message: nullableText(value.message, 'message'),
    incidentId: nullableText(value.incidentId, 'incidentId'),
    resumedAt: nullableInstant(value.resumedAt, 'resumedAt'),
    pausedPairs:
      value.pausedPairs === undefined
        ? []
        : list(value.pausedPairs, 'pausedPairs').map((symbol) =>
            text(symbol, 'pausedPairs[]'),
          ),
    expectedEndAt: nullableInstant(value.expectedEndAt, 'expectedEndAt'),
    retryAt: nullableInstant(value.retryAt, 'retryAt'),
    recovery: recovery
      ? {
          pairsDone: integer(recovery.pairsDone, 'pairsDone'),
          pairsTotal: integer(recovery.pairsTotal, 'pairsTotal'),
        }
      : null,
    displaySource:
      value.displaySource === undefined || value.displaySource === null
        ? 'BINANCE'
        : oneOf(SOURCES, value.displaySource, 'displaySource'),
  };
}

export function decodeMarketStatus(body: unknown): MarketStatus {
  const value = record(body, 'status');
  return {
    markets: list(value.markets, 'markets').map(decodeMarketHealth),
  };
}

export function decodeFallbackPrices(body: unknown): FallbackPrices {
  const value = record(body, 'fallback');
  return {
    market: oneOf(MARKETS, value.market, 'market'),
    source: oneOf(SOURCES, value.source, 'source'),
    asOf: nullableInstant(value.asOf, 'asOf'),
    prices: list(value.prices, 'prices').map((item) => {
      const price = record(item, 'price');
      return {
        symbol: text(price.symbol, 'symbol'),
        lastPrice: decimal(price.lastPrice, 'lastPrice'),
        changePercent24h: nullableDecimal(
          price.changePercent24h,
          'changePercent24h',
        ),
        high24h: nullableDecimal(price.high24h, 'high24h'),
        low24h: nullableDecimal(price.low24h, 'low24h'),
        volume24h: nullableDecimal(price.volume24h, 'volume24h'),
        asOf: nullableInstant(price.asOf, 'asOf'),
        diverged: flag(price.diverged, 'diverged'),
      };
    }),
  };
}

export function decodeMarketIncident(body: unknown): MarketIncident {
  const value = record(body, 'incident');
  return {
    id: text(value.id, 'id'),
    market: oneOf(MARKETS, value.market, 'market'),
    kind: oneOf(['OUTAGE', 'MAINTENANCE'] as const, value.kind, 'kind'),
    reason: oneOf(REASONS, value.reason, 'reason'),
    lastLiveAt: instant(value.lastLiveAt, 'lastLiveAt'),
    pausedAt: instant(value.pausedAt, 'pausedAt'),
    recoveryStartedAt: nullableInstant(
      value.recoveryStartedAt,
      'recoveryStartedAt',
    ),
    resumedAt: nullableInstant(value.resumedAt, 'resumedAt'),
    message: nullableText(value.message, 'message'),
    createdBy: nullableText(value.createdBy, 'createdBy'),
    expectedEndAt: nullableInstant(value.expectedEndAt, 'expectedEndAt'),
  };
}

/** Every market live: what a client without a backend shows. */
export const ALL_LIVE: MarketStatus = {
  markets: MARKETS.map((market) => ({
    market,
    state: 'LIVE',
    tradingOpen: true,
    since: null,
    pausedAt: null,
    reason: null,
    message: null,
    incidentId: null,
    resumedAt: null,
    pausedPairs: [],
    expectedEndAt: null,
    retryAt: null,
    recovery: null,
    displaySource: 'BINANCE',
  })),
};

/** Used while no API base URL is configured: every market live. */
export function createPendingMarketStatusService(): MarketStatusService {
  return {
    status: async () => ALL_LIVE,
    subscribe: () => () => undefined,
    fallback: async (market) => ({
      market,
      source: 'BINANCE',
      asOf: null,
      prices: [],
    }),
    subscribeFallback: () => () => undefined,
    maintenance: async () => integrationPending(),
    resume: async () => integrationPending(),
    incidents: async () => integrationPending(),
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/**
 * `/market/status` and `/market/fallback` (public) and
 * `/admin/market/**` (Admin only), with the pushes on the public feed.
 */
export function createHttpMarketStatusService(
  http: HttpClient,
  feed: StompTopics | null = null,
): MarketStatusService {
  return {
    status: (signal) =>
      http.request({
        path: 'market/status',
        decode: decodeMarketStatus,
        ...withSignal(signal),
      }),
    subscribe: (listener) =>
      feed
        ? feed.subscribeTopic(STATUS_TOPIC, decodeMarketStatus, listener)
        : () => undefined,
    fallback: (market, signal) =>
      http.request({
        path: 'market/fallback?market=' + market,
        decode: decodeFallbackPrices,
        ...withSignal(signal),
      }),
    subscribeFallback: (market, listener) =>
      feed
        ? feed.subscribeTopic(
            fallbackTopic(market),
            decodeFallbackPrices,
            listener,
          )
        : () => undefined,
    maintenance: (input) =>
      http.request({
        path: 'admin/market/maintenance',
        method: 'POST',
        body: input,
        decode: decodeMarketStatus,
      }),
    resume: (market) =>
      http.request({
        path: 'admin/market/resume',
        method: 'POST',
        body: { market },
        decode: decodeMarketStatus,
      }),
    incidents: (market, limit, signal) =>
      http.request({
        path: 'admin/market/incidents?market=' + market + '&limit=' + limit,
        decode: (body) => list(body, 'incidents').map(decodeMarketIncident),
        ...withSignal(signal),
      }),
  };
}
