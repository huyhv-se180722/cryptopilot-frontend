import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useServices } from '../../../hooks/use-services';
import type { MarketTicker, MarketType } from '../../../types/domain';

/** CR-09: Delayed after 10 s without a message; then poll every 10 s. */
export const STALE_AFTER_MS = 10_000;
export const POLL_EVERY_MS = 10_000;
/**
 * Pairs refreshed per poll. No endpoint returns every ticker at once, so
 * the snapshots are read a few pairs per round, in turn, instead of one
 * burst of 13–50 requests every 10 s.
 */
export const POLL_BATCH = 6;

export type FeedFreshness = 'connecting' | 'live' | 'delayed';

export interface MarketTickers {
  tickers: ReadonlyMap<string, MarketTicker>;
  freshness: FeedFreshness;
}

interface FeedState {
  market: MarketType;
  tickers: ReadonlyMap<string, MarketTicker>;
  lastMessageAt: number | null;
  startedAt: number;
}

const fresh = (market: MarketType): FeedState => ({
  market,
  tickers: new Map(),
  lastMessageAt: null,
  startedAt: Date.now(),
});

const newer = (current: MarketTicker | undefined, next: MarketTicker) =>
  !current || Date.parse(next.sourceTime) >= Date.parse(current.sourceTime);

/**
 * Latest tickers of a market from the overview topic, with the CR-09
 * Live / Delayed state. While Delayed, the stored snapshots of `symbols`
 * are polled in turn so prices keep moving without the socket.
 */
export function useMarketTickers(
  market: MarketType,
  symbols: readonly string[],
): MarketTickers {
  const { market: service, marketFeed } = useServices();
  const status = useSyncExternalStore(
    marketFeed.onStatus,
    marketFeed.status,
    marketFeed.status,
  );
  const [state, setState] = useState(() => fresh(market));
  // Switching tab starts over: no ticker of the other market is kept.
  if (state.market !== market) setState(fresh(market));
  const [now, setNow] = useState(() => Date.now());

  const merge = useCallback(
    (incoming: readonly MarketTicker[], fromStream: boolean) =>
      setState((current) => {
        if (current.market !== market) return current;
        let tickers: Map<string, MarketTicker> | null = null;
        for (const ticker of incoming) {
          if (ticker.market !== market) continue;
          if (!newer(current.tickers.get(ticker.symbol), ticker)) continue;
          tickers ??= new Map(current.tickers);
          tickers.set(ticker.symbol, ticker);
        }
        if (!tickers && !fromStream) return current;
        return {
          ...current,
          tickers: tickers ?? current.tickers,
          lastMessageAt: fromStream ? Date.now() : current.lastMessageAt,
        };
      }),
    [market],
  );

  useEffect(
    () =>
      marketFeed.subscribeOverview(market, (overview) =>
        merge(overview.tickers, true),
      ),
    [market, marketFeed, merge],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const current = state.market === market ? state : fresh(market);
  const sinceMessage = now - (current.lastMessageAt ?? current.startedAt);
  const freshness: FeedFreshness =
    status === 'open' &&
    current.lastMessageAt !== null &&
    sinceMessage <= STALE_AFTER_MS
      ? 'live'
      : status === 'unavailable' || sinceMessage > STALE_AFTER_MS
        ? 'delayed'
        : 'connecting';

  const delayed = freshness === 'delayed';
  const symbolKey = symbols.join(',');
  useEffect(() => {
    if (!delayed || symbolKey === '') return;
    const list = symbolKey.split(',');
    const controller = new AbortController();
    let cursor = 0;
    const poll = () => {
      const batch = Array.from(
        { length: Math.min(POLL_BATCH, list.length) },
        (_, i) => list[(cursor + i) % list.length] as string,
      );
      cursor = (cursor + batch.length) % list.length;
      for (const symbol of batch)
        service.getTicker(market, symbol, controller.signal).then(
          (ticker) => {
            if (ticker && !controller.signal.aborted) merge([ticker], false);
          },
          // A failed snapshot keeps the last value; the next round retries.
          () => undefined,
        );
    };
    poll();
    const timer = setInterval(poll, POLL_EVERY_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [delayed, symbolKey, market, service, merge]);

  return { tickers: current.tickers, freshness };
}
