import type { AnalysisService } from './contracts';
import { decodeAnalysis } from './analysis-dto';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';

/** Used while no API base URL is configured. */
export function createPendingAnalysisService(): AnalysisService {
  return { get: async () => integrationPending() };
}

/**
 * `GET /analysis/{market}/{symbol}?tf=` with the bearer token: Trader
 * only, and the score is read with the caller's trading style (D-53).
 */
export function createHttpAnalysisService(http: HttpClient): AnalysisService {
  return {
    get: (market, symbol, timeframe, signal) =>
      http.request({
        path: `analysis/${market}/${encodeURIComponent(symbol)}?tf=${timeframe}`,
        decode: decodeAnalysis,
        ...(signal ? { signal } : {}),
      }),
  };
}
