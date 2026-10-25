import { createContext, useContext } from 'react';
import type { MarketPair, MarketTicker } from '../../../types/domain';

/** A coin as the community shows it: its Spot pair and latest ticker. */
export interface CoinQuote {
  coin: string;
  pair: MarketPair;
  ticker: MarketTicker | undefined;
}

export interface CoinPrices {
  /** By base asset, e.g. "BTC"; only coins a Spot pair trades. */
  quotes: ReadonlyMap<string, CoinQuote>;
  /** Spot pairs in the administrator's display order. */
  pairs: readonly MarketPair[];
}

export const CoinPricesContext = createContext<CoinPrices>({
  quotes: new Map(),
  pairs: [],
});

/** The live Spot prices of the community screen, if it provides them. */
export function useCoinPrices(): CoinPrices {
  return useContext(CoinPricesContext);
}
