import { useEffect } from 'react';
import type { MarketType } from '../../../types/domain';

const STORAGE_KEY = 'cp-chart-pair';

export interface ChartPair {
  market: MarketType;
  symbol: string;
}

/**
 * The market and pair last opened on the Chart screen, remembered on this
 * device so that coming back to /chart reopens it. Without storage the
 * screen opens the first Spot pair.
 */
export function readLastChartPair(): ChartPair | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const stored: unknown = raw ? JSON.parse(raw) : null;
    if (typeof stored !== 'object' || stored === null) return null;
    const { market, symbol } = stored as Record<string, unknown>;
    return (market === 'spot' || market === 'futures') &&
      typeof symbol === 'string' &&
      symbol !== ''
      ? { market, symbol }
      : null;
  } catch {
    return null;
  }
}

/** Remembers the pair while the Chart screen shows it. */
export function useRememberChartPair(market: MarketType, symbol: string) {
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ market, symbol }),
      );
    } catch {
      // Not remembered; the next visit opens the first pair.
    }
  }, [market, symbol]);
}
