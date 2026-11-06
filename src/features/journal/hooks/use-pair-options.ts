import { useMemo } from 'react';
import { useMarketPairs } from '../../market/hooks/use-market-data';
import type { MarketPair } from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';
import type { MarketChoice } from '../model/performance-view';

export interface PairOption {
  pairId: string;
  label: string;
}

/** The pairs of a market, or of both with one row per id (FEQ-01). */
export function usePairOptions(market: MarketChoice): readonly PairOption[] {
  const spot = useMarketPairs('spot').data;
  const futures = useMarketPairs('futures').data;
  return useMemo(() => {
    const pairs: readonly MarketPair[] =
      market === 'spot'
        ? (spot ?? [])
        : market === 'futures'
          ? (futures ?? [])
          : [...(spot ?? []), ...(futures ?? [])];
    const unique = new Map(
      pairs.map((pair) => [pair.pairId, pairLabel(pair.symbol)] as const),
    );
    return [...unique].map(([pairId, label]) => ({ pairId, label }));
  }, [market, spot, futures]);
}
