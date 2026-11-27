import type { Decimal } from '../../types/domain';
import { decimal, instant, integer, list, oneOf, record, text } from './decode';
import { integrationPending, ServiceError } from './errors';
import type { HttpClient } from './http-client';
import type { HealthMarket } from './market-status';

const MARKETS: readonly HealthMarket[] = ['SPOT', 'FUTURES'];

/** The longest outage the fault switch accepts (backend `StreamFaultRequest`). */
export const MAX_OUTAGE_SECONDS = 300;

/** A price replay scenario the test environment can play (RF-07). */
export interface ReplayScenario {
  name: string;
  description: string;
  market: HealthMarket;
  symbol: string;
  lengthSeconds: number;
  firstPrice: Decimal;
  lastPrice: Decimal;
}

/** A price replay running now: its pair takes the scripted prices. */
export interface RunningReplay {
  scenario: string;
  market: HealthMarket;
  symbol: string;
  startedAt: string;
  /** After this the last price is held until the replay is stopped. */
  endsAt: string;
  price: Decimal;
}

/** What the fault switch cut (RF-12). */
export interface StreamCut {
  market: HealthMarket;
  connectionsCut: number;
  /** The start of the reconnect time NFR-06 measures. */
  cutAt: string;
  reconnectFrom: string;
}

/**
 * The market tools of a test environment (RF-07, RF-12), Admin only: the
 * price replay that drives a pair along a scripted path, and the switch that
 * cuts a market's exchange streams. The backend has them only on `dev` and
 * `demo` (staging); elsewhere every path answers 404.
 */
export interface MarketTestToolsService {
  scenarios(signal?: AbortSignal): Promise<ReplayScenario[]>;
  replays(signal?: AbortSignal): Promise<RunningReplay[]>;
  startReplay(scenario: string): Promise<RunningReplay>;
  stopReplay(market: HealthMarket, symbol: string): Promise<void>;
  cutStreams(market: HealthMarket, outageSeconds: number): Promise<StreamCut>;
}

/** Whether an error says the environment has no test tools (or no backend). */
export function toolsAbsent(error: unknown): boolean {
  return (
    error instanceof ServiceError &&
    (error.code === 'NOT_CONFIGURED' || error.status === 404)
  );
}

/** `ReplayScenarioResponse`, backend feat/rf12-market-stream-fault-switch. */
export function decodeReplayScenario(body: unknown): ReplayScenario {
  const value = record(body, 'scenario');
  return {
    name: text(value.name, 'name'),
    description: text(value.description, 'description'),
    market: oneOf(MARKETS, value.market, 'market'),
    symbol: text(value.symbol, 'symbol'),
    lengthSeconds: integer(value.lengthSeconds, 'lengthSeconds'),
    firstPrice: decimal(value.firstPrice, 'firstPrice'),
    lastPrice: decimal(value.lastPrice, 'lastPrice'),
  };
}

/** `ReplayResponse`. */
export function decodeRunningReplay(body: unknown): RunningReplay {
  const value = record(body, 'replay');
  return {
    scenario: text(value.scenario, 'scenario'),
    market: oneOf(MARKETS, value.market, 'market'),
    symbol: text(value.symbol, 'symbol'),
    startedAt: instant(value.startedAt, 'startedAt'),
    endsAt: instant(value.endsAt, 'endsAt'),
    price: decimal(value.price, 'price'),
  };
}

/** `StreamFaultResponse`. */
export function decodeStreamCut(body: unknown): StreamCut {
  const value = record(body, 'cut');
  return {
    market: oneOf(MARKETS, value.market, 'market'),
    connectionsCut: integer(value.connectionsCut, 'connectionsCut'),
    cutAt: instant(value.cutAt, 'cutAt'),
    reconnectFrom: instant(value.reconnectFrom, 'reconnectFrom'),
  };
}

/** Used while no API base URL is configured: no test tools. */
export function createPendingMarketTestToolsService(): MarketTestToolsService {
  return {
    scenarios: async () => integrationPending(),
    replays: async () => integrationPending(),
    startReplay: async () => integrationPending(),
    stopReplay: async () => integrationPending(),
    cutStreams: async () => integrationPending(),
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** `/admin/market/replay/**` and `/admin/market/fault/stream-cut`. */
export function createHttpMarketTestToolsService(
  http: HttpClient,
): MarketTestToolsService {
  return {
    scenarios: (signal) =>
      http.request({
        path: 'admin/market/replay/scenarios',
        decode: (body) => list(body, 'scenarios').map(decodeReplayScenario),
        ...withSignal(signal),
      }),
    replays: (signal) =>
      http.request({
        path: 'admin/market/replay',
        decode: (body) => list(body, 'replays').map(decodeRunningReplay),
        ...withSignal(signal),
      }),
    startReplay: (scenario) =>
      http.request({
        path: 'admin/market/replay',
        method: 'POST',
        body: { scenario },
        decode: decodeRunningReplay,
      }),
    stopReplay: (market, symbol) =>
      http.request({
        path: 'admin/market/replay/stop',
        method: 'POST',
        body: { market, symbol },
        decode: () => undefined,
      }),
    cutStreams: (market, outageSeconds) =>
      http.request({
        path: 'admin/market/fault/stream-cut',
        method: 'POST',
        body: { market, outageSeconds },
        decode: decodeStreamCut,
      }),
  };
}
