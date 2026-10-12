import type { TradingPlanService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeCalculation,
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
    calculate: async () => integrationPending(),
    update: async () => integrationPending(),
  };
}

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});
const planPath = (id: string) => 'plans/' + encodeURIComponent(id);

/**
 * `/plans/**` with the bearer token (Trader only). The list filter spells
 * the market in upper case, unlike `/market/**`.
 */
export function createHttpTradingPlanService(
  http: HttpClient,
): TradingPlanService {
  return {
    list: ({ tab, market, from, page, pageSize }, signal) => {
      const params = new URLSearchParams({
        tab,
        page: String(page),
        pageSize: String(pageSize),
      });
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
    activate: (id) =>
      http.request({
        path: planPath(id) + '/activate',
        method: 'POST',
        decode: decodePlan,
      }),
    cancel: (id) =>
      http.request({
        path: planPath(id) + '/cancel',
        method: 'POST',
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
    update: (id, inputs, activate) =>
      http.request({
        path: planPath(id),
        method: 'PUT',
        body: { ...encodePlanInputs(inputs), activate },
        decode: decodePlan,
      }),
  };
}
