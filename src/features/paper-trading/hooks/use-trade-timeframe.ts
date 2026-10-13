import { useCallback, useState } from 'react';
import type { CandleTimeframe } from '../../../types/domain';

const STORAGE_KEY = 'cp-trade-timeframe';
const TIMEFRAMES: readonly CandleTimeframe[] = ['15m', '1h', '4h', '1d'];

function read(): CandleTimeframe {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return TIMEFRAMES.find((timeframe) => timeframe === stored) ?? '1h';
  } catch {
    return '1h';
  }
}

/**
 * The trading chart's timeframe, remembered on this device for every pair
 * as an exchange does (plan section 5). Without storage (private window,
 * blocked site data) the choice lasts for the page only.
 */
export function useTradeTimeframe() {
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(read);
  const choose = useCallback((next: CandleTimeframe) => {
    setTimeframe(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered; the chart still switches.
    }
  }, []);
  return [timeframe, choose] as const;
}
