import type { AdminPairService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeAdminPair,
  decodeAdminPairs,
  decodeExchangeSymbols,
  decodePairBrackets,
  encodeBrackets,
  encodePairSettings,
} from './admin-pairs-dto';

/** Used while no API base URL is configured. */
export function createPendingAdminPairService(): AdminPairService {
  return {
    list: async () => integrationPending(),
    exchangeSymbols: async () => integrationPending(),
    register: async () => integrationPending(),
    update: async () => integrationPending(),
    brackets: async () => integrationPending(),
    replaceBrackets: async () => integrationPending(),
  };
}

const id = (value: string) => encodeURIComponent(value);
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});
const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams(
    Object.entries(values).filter(
      (entry): entry is [string, string] => !!entry[1],
    ),
  ).toString();
  return params ? '?' + params : '';
};

/**
 * `/admin/pairs/**` (UC-45, UC-46), Admin only, checked against backend
 * develop @ dccfc6c: the pairs with their markets and bracket counts, the
 * exchange's symbols to register, the settings of a pair and its leverage
 * brackets, replaced as a whole.
 */
export function createHttpAdminPairService(http: HttpClient): AdminPairService {
  return {
    list: ({ q, status }, signal) =>
      http.request({
        path: 'admin/pairs' + query({ q, status }),
        decode: decodeAdminPairs,
        ...withSignal(signal),
      }),
    exchangeSymbols: (q, signal) =>
      http.request({
        path: 'admin/pairs/exchange-symbols' + query({ q }),
        decode: decodeExchangeSymbols,
        ...withSignal(signal),
      }),
    register: (symbol) =>
      http.request({
        path: 'admin/pairs',
        method: 'POST',
        body: { symbol },
        decode: decodeAdminPair,
      }),
    update: (pairId, settings) =>
      http.request({
        path: 'admin/pairs/' + id(pairId),
        method: 'PUT',
        body: encodePairSettings(settings),
        decode: decodeAdminPair,
      }),
    brackets: (pairId, signal) =>
      http.request({
        path: 'admin/pairs/' + id(pairId) + '/brackets',
        decode: decodePairBrackets,
        ...withSignal(signal),
      }),
    replaceBrackets: (pairId, brackets) =>
      http.request({
        path: 'admin/pairs/' + id(pairId) + '/brackets',
        method: 'PUT',
        body: encodeBrackets(brackets),
        decode: decodePairBrackets,
      }),
  };
}
