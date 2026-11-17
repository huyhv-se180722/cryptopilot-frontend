import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { CoinMarket, CoinSentiment } from '../../../types/domain';
import { coinView, type CoinView } from '../coin-market';
import { useMarketTickers, type FeedFreshness } from './use-market-tickers';

/** The server's figures change with the 15-minute candles; a minute is plenty. */
const REFRESH_MS = 60_000;

export interface CoinMarketBoard {
  data: CoinMarket | undefined;
  isPending: boolean;
  error: unknown;
  rows: readonly CoinView[];
  /** Summed 24h quote volume of the listed Futures pairs, from the live tickers. */
  futuresVolume: string | null;
  freshness: FeedFreshness;
  refetch: () => void;
}

/**
 * The market list of coins (SCR-09): the server's figures, refreshed every
 * minute, joined with the live Spot and Futures tickers and the community's
 * leaning, so prices and the changes computed from them move live.
 */
export function useCoinMarket(): CoinMarketBoard {
  const { market, community } = useServices();
  const query = useQuery({
    queryKey: ['market', 'coins'],
    queryFn: ({ signal }) => market.getCoinMarket(signal),
    refetchInterval: REFRESH_MS,
  });
  const sentiment = useQuery({
    queryKey: ['community', 'coin-sentiment'],
    queryFn: ({ signal }) => community.coinSentiment(signal),
    staleTime: 5 * REFRESH_MS,
  });
  const coins = useMemo(() => query.data?.coins ?? [], [query.data]);
  const spotSymbols = useMemo(
    () => coins.flatMap((coin) => (coin.spotSymbol ? [coin.spotSymbol] : [])),
    [coins],
  );
  const futuresSymbols = useMemo(
    () =>
      coins.flatMap((coin) => (coin.futuresSymbol ? [coin.futuresSymbol] : [])),
    [coins],
  );
  const spot = useMarketTickers('spot', spotSymbols);
  const futures = useMarketTickers('futures', futuresSymbols);
  const leaning = useMemo(() => {
    const bySymbol = new Map<string, CoinSentiment>();
    for (const item of sentiment.data ?? []) bySymbol.set(item.symbol, item);
    return bySymbol;
  }, [sentiment.data]);

  const rows = useMemo(
    () =>
      coins.map((coin) =>
        coinView(
          coin,
          coin.spotSymbol ? spot.tickers.get(coin.spotSymbol) : undefined,
          coin.futuresSymbol
            ? futures.tickers.get(coin.futuresSymbol)
            : undefined,
          leaning.get(coin.symbol) ?? null,
        ),
      ),
    [coins, spot.tickers, futures.tickers, leaning],
  );

  const futuresVolume = useMemo(() => {
    let total: number | null = null;
    for (const symbol of futuresSymbols) {
      const volume = futures.tickers.get(symbol)?.quoteVolume24h;
      if (volume) total = (total ?? 0) + Number(volume);
    }
    return total === null ? null : total.toFixed(2);
  }, [futuresSymbols, futures.tickers]);

  return {
    data: query.data,
    isPending: query.isPending,
    error: query.error,
    rows,
    futuresVolume,
    freshness: spot.freshness,
    refetch: () => void query.refetch(),
  };
}
