import type { TradingPlanService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import type { AccountFeed } from './paper-trading';
import {
  decodeCalculation,
  decodeCloseEstimate,
  decodePositionUpdate,
  decodePlan,
  decodePlanPage,
  encodePlanInputs,
} from './trading-plan-dto';

/** Used while no API base URL is configured. */
export function createPendingTradingPlanService(): TradingPlanService {
  return {
    list: async () => integrationPending(),
    get: async () => integrationPending(),
    activate: async () => integrationPending(),
    cancel: async () => integrationPending(),
    create: async () => integrationPending(),
    calculate: async () => integrationPending(),
    update: async () => integrationPending(),
    changeLevels: async () => integrationPending(),
    closeEstimate: async () => integrationPending(),
    closePosition: async () => integrationPending(),
    subscribePositions: () => () => undefined,
  };
}

/** The queue a closed position is pushed on (T-048b, T-046). */
export const POSITION_QUEUE = '/user/queue/positions';

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});
const planPath = (id: string) => 'plans/' + encodeURIComponent(id);

/**
 * `/plans/**` with the bearer token (Trader only). The list filter spells
 * the market in upper case, unlike `/market/**`.
 */
export function createHttpTradingPlanService(
  http: HttpClient,
  feed: AccountFeed | null = null,
): TradingPlanService {
  return {
    list: ({ tab, pairId, market, from, page, pageSize }, signal) => {
      const params = new URLSearchParams({
        tab,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (pairId) params.set('pairId', pairId);
      if (market) params.set('market', market.toUpperCase());
      if (from) params.set('from', from);
      return http.request({
        path: 'plans?' + params.toString(),
        decode: decodePlanPage,
        ...withSignal(signal),
      });
    },
    get: (id, signal) =>
      http.request({
        path: planPath(id),
        decode: decodePlan,
        ...withSignal(signal),
      }),
    activate: (id, confirmDeviation = false) =>
      http.request({
        path:
          planPath(id) +
          '/activate' +
          (confirmDeviation ? '?confirmDeviation=true' : ''),
        method: 'POST',
        decode: decodePlan,
      }),
    cancel: (id) =>
      http.request({
        path: planPath(id) + '/cancel',
        method: 'POST',
        decode: decodePlan,
      }),
    create: (pairId, inputs, activate, confirmDeviation = false) =>
      http.request({
        path: 'plans',
        method: 'POST',
        body: {
          pairId,
          ...encodePlanInputs(inputs),
          activate,
          ...(confirmDeviation ? { confirmDeviation: true } : {}),
        },
        decode: decodePlan,
      }),
    calculate: (pairId, inputs, signal) =>
      http.request({
        path: 'plans/calculate',
        method: 'POST',
        body: { pairId, ...encodePlanInputs(inputs) },
        decode: decodeCalculation,
        ...withSignal(signal),
      }),
    update: (id, inputs, activate, confirmDeviation = false) =>
      http.request({
        path: planPath(id),
        method: 'PUT',
        body: {
          ...encodePlanInputs(inputs),
          activate,
          ...(confirmDeviation ? { confirmDeviation: true } : {}),
        },
        decode: decodePlan,
      }),
    // Only the levels given are sent; an absent one keeps the current.
    changeLevels: (id, levels) =>
      http.request({
        path: planPath(id) + '/position-levels',
        method: 'PATCH',
        body: {
          ...(levels.stopLoss !== null ? { stopLoss: levels.stopLoss } : {}),
          ...(levels.takeProfit !== null
            ? { takeProfit: levels.takeProfit }
            : {}),
        },
        decode: decodePlan,
      }),
    closeEstimate: (id, signal) =>
      http.request({
        path: planPath(id) + '/close-estimate',
        decode: decodeCloseEstimate,
        ...withSignal(signal),
      }),
    closePosition: (id) =>
      http.request({
        path: planPath(id) + '/close-position',
        method: 'POST',
        decode: decodePlan,
      }),
    subscribePositions: (listener) =>
      feed
        ? feed.subscribeTopic(POSITION_QUEUE, decodePositionUpdate, listener)
        : () => undefined,
  };
}
