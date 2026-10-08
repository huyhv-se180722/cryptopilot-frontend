import { useEffect, useState, useSyncExternalStore } from 'react';
import { useServices } from '../../../hooks/use-services';
import type { MarketTicker, MarketType } from '../../../types/domain';
import {
  POLL_EVERY_MS,
  STALE_AFTER_MS,
  type FeedFreshness,
} from '../../market/hooks/use-market-tickers';

interface State {
  key: string;
  ticker: MarketTicker | null;
  lastMessageAt: number | null;
  startedAt: number;
}

const fresh = (key: string): State => ({
  key,
  ticker: null,
  lastMessageAt: null,
  startedAt: Date.now(),
});

const newer = (current: MarketTicker | null, next: MarketTicker) =>
  !current || Date.parse(next.sourceTime) >= Date.parse(current.sourceTime);

/**
 * One pair's ticker from `/topic/ticker.*` with the CR-09 Live / Delayed
 * state; while Delayed, the stored snapshot is read every 10 s.
 */
export function useLiveTicker(market: MarketType, symbol: string) {
  const { market: service, marketFeed } = useServices();
  const key = `${market}.${symbol}`;
  const status = useSyncExternalStore(
    marketFeed.onStatus,
    marketFeed.status,
    marketFeed.status,
  );
  const [state, setState] = useState(() => fresh(key));
  if (state.key !== key) setState(fresh(key));
  const [now, setNow] = useState(() => Date.now());

  useEffect(
    () =>
      marketFeed.subscribeTicker(market, symbol, (ticker) =>
        setState((current) =>
          current.key !== key
            ? current
            : {
                ...current,
                ticker: newer(current.ticker, ticker) ? ticker : current.ticker,
                lastMessageAt: Date.now(),
              },
        ),
      ),
    [market, symbol, key, marketFeed],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const current = state.key === key ? state : fresh(key);
  const since = now - (current.lastMessageAt ?? current.startedAt);
  const freshness: FeedFreshness =
    status === 'open' &&
    current.lastMessageAt !== null &&
    since <= STALE_AFTER_MS
      ? 'live'
      : status === 'unavailable' || since > STALE_AFTER_MS
        ? 'delayed'
        : 'connecting';

  const delayed = freshness === 'delayed';
  useEffect(() => {
    if (!delayed) return;
    const controller = new AbortController();
    const poll = () =>
      service.getTicker(market, symbol, controller.signal).then(
        (ticker) => {
          if (!ticker || controller.signal.aborted) return;
          setState((latest) =>
            latest.key === key && newer(latest.ticker, ticker)
              ? { ...latest, ticker }
              : latest,
          );
        },
        // The last value stays; the next round tries again.
        () => undefined,
      );
    void poll();
    const timer = setInterval(() => void poll(), POLL_EVERY_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [delayed, market, symbol, key, service]);

  return { ticker: current.ticker, freshness };
}
