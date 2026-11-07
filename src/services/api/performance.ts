import type {
  PerformanceBreakdownKind,
  PerformanceFilter,
} from '../../types/domain';
import type { PerformanceService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeEquityCurve,
  decodePerformanceBreakdown,
  decodePerformanceSummary,
} from './performance-dto';

const BREAKDOWN_PATHS: Record<PerformanceBreakdownKind, string> = {
  coin: 'by-coin',
  strategy: 'by-strategy',
  market: 'by-market',
};

/** Used while no API base URL is configured. */
export function createPendingPerformanceService(): PerformanceService {
  return {
    summary: async () => integrationPending(),
    breakdown: async () => integrationPending(),
    equityCurve: async () => integrationPending(),
  };
}

function query({
  from,
  to,
  market,
  source,
  pairId,
  strategyId,
}: PerformanceFilter): string {
  const params = new URLSearchParams({ source });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (market) params.set('market', market.toUpperCase());
  if (pairId) params.set('pairId', pairId);
  if (strategyId) params.set('strategyId', strategyId);
  return '?' + params.toString();
}

/** `/journal/performance/*` with the bearer token (Trader only). */
export function createHttpPerformanceService(
  http: HttpClient,
): PerformanceService {
  return {
    summary: (filter, signal) =>
      http.request({
        path: 'journal/performance/summary' + query(filter),
        decode: decodePerformanceSummary,
        ...(signal ? { signal } : {}),
      }),
    breakdown: (kind, filter, signal) =>
      http.request({
        path: `journal/performance/${BREAKDOWN_PATHS[kind]}${query(filter)}`,
        decode: decodePerformanceBreakdown,
        ...(signal ? { signal } : {}),
      }),
    equityCurve: (filter, signal) =>
      http.request({
        path: 'journal/performance/equity-curve' + query(filter),
        decode: decodeEquityCurve,
        ...(signal ? { signal } : {}),
      }),
  };
}
