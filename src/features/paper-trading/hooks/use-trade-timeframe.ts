import { useCallback, useState } from 'react';
import type { ChartTimeframe, MarketType } from '../../../types/domain';
import { chartTimeframesOf } from '../../../utils/chart-timeframe';

const STORAGE_KEY = 'cp-trade-timeframe';

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The trading chart's timeframe, remembered on this device for every pair
 * as an exchange does (plan section 5): any of the sixteen of TR-35, 1s on
 * Spot only. Without storage (private window,
 * blocked site data) the choice lasts for the page only.
 */
export function useTradeTimeframe(market: MarketType) {
  const timeframes = chartTimeframesOf(market);
  const [chosen, setTimeframe] = useState<string | null>(read);
  // 1s is Spot only: a Futures chart opened after it shows 1m.
  const timeframe: ChartTimeframe =
    timeframes.find((each) => each === chosen) ??
    (chosen === '1s' ? '1m' : '1h');
  const choose = useCallback(
    (next: ChartTimeframe) => {
      setTimeframe(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Not remembered; the chart still switches.
      }
    },
    [setTimeframe],
  );
  return [timeframe, choose, timeframes] as const;
}
