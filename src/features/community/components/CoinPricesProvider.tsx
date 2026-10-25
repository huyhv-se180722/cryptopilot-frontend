import { useMemo, type ReactNode } from 'react';
import { useMarketPairs } from '../../market/hooks/use-market-data';
import { useMarketTickers } from '../../market/hooks/use-market-tickers';
import {
  CoinPricesContext,
  type CoinPrices,
  type CoinQuote,
} from './coin-prices';

/**
 * Live Spot prices for the community screens (D-99): the coin list and the
 * coin chips of the cards read the same tickers, one subscription.
 */
export function CoinPricesProvider({ children }: { children: ReactNode }) {
  const pairs = useMarketPairs('spot');
  const list = useMemo(() => pairs.data ?? [], [pairs.data]);
  const symbols = useMemo(() => list.map((p) => p.symbol), [list]);
  const { tickers } = useMarketTickers('spot', symbols);
  const value = useMemo<CoinPrices>(() => {
    const quotes = new Map<string, CoinQuote>();
    for (const pair of list) {
      const coin = pair.baseAsset ?? pair.symbol;
      if (!quotes.has(coin))
        quotes.set(coin, { coin, pair, ticker: tickers.get(pair.symbol) });
    }
    return { quotes, pairs: list };
  }, [list, tickers]);
  return (
    <CoinPricesContext.Provider value={value}>
      {children}
    </CoinPricesContext.Provider>
  );
}
