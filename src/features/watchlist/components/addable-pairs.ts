import type { MarketPair } from '../../../types/domain';

/** A pair of the market lists that can be added, with where it is listed. */
export interface AddablePair {
  pairId: string;
  symbol: string;
  baseAsset: string | null;
  baseAssetName: string | null;
  spot: boolean;
  futures: boolean;
}

/**
 * Both market lists as one, by pair id (one id per symbol on both markets,
 * FEQ-01): the Spot pairs in display order, then the pairs listed on
 * Futures only.
 */
export function addablePairs(
  spot: readonly MarketPair[],
  futures: readonly MarketPair[],
): AddablePair[] {
  const onFutures = new Set(futures.map((pair) => pair.pairId));
  const onSpot = new Set(spot.map((pair) => pair.pairId));
  const row = (pair: MarketPair): AddablePair => ({
    pairId: pair.pairId,
    symbol: pair.symbol,
    baseAsset: pair.baseAsset,
    baseAssetName: pair.baseAssetName,
    spot: onSpot.has(pair.pairId),
    futures: onFutures.has(pair.pairId),
  });
  return [
    ...spot.map(row),
    ...futures.filter((pair) => !onSpot.has(pair.pairId)).map(row),
  ];
}

/** Whether a pair matches a search by symbol, coin or coin name. */
export function matchesPair(pair: AddablePair, query: string): boolean {
  const q = query.trim().toLowerCase().replace('/', '');
  if (!q) return true;
  return [pair.symbol, pair.baseAsset ?? '', pair.baseAssetName ?? ''].some(
    (text) => text.toLowerCase().includes(q),
  );
}
