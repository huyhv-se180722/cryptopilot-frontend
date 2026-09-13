import { useEffect, useState } from 'react';
import { useServices } from '../../../hooks/use-services';
import type { MarketQuote, MarketType } from '../../../types/domain';

type MarketState =
  | { status: 'loading' }
  | { status: 'success'; items: readonly MarketQuote[] }
  | { status: 'error'; message: string };

/** Reference data flow for future screens. Cancels and discards stale requests. */
export function useMarketQuotes(marketType: MarketType) {
  const { market } = useServices();
  const [state, setState] = useState<{
    marketType: MarketType;
    value: MarketState;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    market.list({ marketType, signal: controller.signal }).then(
      (response) => {
        if (!controller.signal.aborted)
          setState({
            marketType,
            value: { status: 'success', items: response.items },
          });
      },
      () => {
        if (!controller.signal.aborted)
          setState({
            marketType,
            value: { status: 'error', message: 'Market data is unavailable.' },
          });
      },
    );
    return () => controller.abort();
  }, [market, marketType]);
  return state?.marketType === marketType
    ? state.value
    : ({ status: 'loading' } as const);
}
