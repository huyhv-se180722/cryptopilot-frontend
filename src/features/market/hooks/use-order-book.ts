import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOnFeedOpen } from '../../../hooks/use-on-feed-open';
import { useServices } from '../../../hooks/use-services';
import type { MarketTrade, MarketType, OrderBook } from '../../../types/domain';
import { useFrameState } from './use-frame-state';

/** The trades panel lists this many, newest first (plan section 5). */
export const TRADES_SHOWN = 50;

interface Live<T> {
  key: string;
  value: T;
  /** When the last message arrived (ms), for the latency dot. */
  at: number | null;
}

export interface MarketStream<T> {
  status: 'loading' | 'error' | 'ready';
  error: unknown;
  value: T;
  /** Arrival of the last topic message, or null before the first one. */
  updatedAt: number | null;
  retry: () => void;
}

/** A book replaces another only when it is not older (`lastUpdateId`). */
const notOlder = (next: OrderBook, current: OrderBook | null | undefined) =>
  !current ||
  next.lastUpdateId === null ||
  current.lastUpdateId === null ||
  next.lastUpdateId >= current.lastUpdateId;

/**
 * A pair's top 20 levels a side (TR-03): the stored book first, then each
 * newer book from the topic, painted at most once per frame.
 */
export function useOrderBook(
  market: MarketType,
  symbol: string,
): MarketStream<OrderBook | null> {
  const { tradingMarket } = useServices();
  const key = `${market}.${symbol}`;
  const snapshot = useQuery({
    queryKey: ['market', 'depth', market, symbol],
    queryFn: ({ signal }) => tradingMarket.getDepth(market, symbol, signal),
    staleTime: Infinity,
  });
  const [live, push] = useFrameState<Live<OrderBook | null>>(() => ({
    key,
    value: null,
    at: null,
  }));

  useEffect(
    () =>
      tradingMarket.subscribeDepth(market, symbol, (book) =>
        push((current) => {
          const base = current.key === key ? current : { key, value: null };
          return notOlder(book, base.value)
            ? { key, value: book, at: Date.now() }
            : { ...base, at: Date.now() };
        }),
      ),
    [tradingMarket, market, symbol, key, push],
  );

  const streamed = live.key === key ? live.value : null;
  const book =
    streamed && notOlder(streamed, snapshot.data)
      ? streamed
      : (snapshot.data ?? streamed);
  return {
    status: book ? 'ready' : snapshot.isError ? 'error' : 'loading',
    error: snapshot.error,
    value: book,
    updatedAt: live.key === key ? live.at : null,
    retry: () => void snapshot.refetch(),
  };
}

/** Newest first, one row per trade id, at most `TRADES_SHOWN`. */
function newestFirst(...lists: (readonly MarketTrade[])[]): MarketTrade[] {
  const byId = new Map<number, MarketTrade>();
  for (const list of lists) for (const trade of list) byId.set(trade.id, trade);
  return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, TRADES_SHOWN);
}

/**
 * A pair's latest market trades (TR-03): the stored ones first, then each
 * push of the topic, painted at most once per frame. The stored ones are
 * read again whenever the feed opens, so trades made while it was down
 * fill in (the depth needs no such read: each push is a whole book).
 */
export function useMarketTrades(
  market: MarketType,
  symbol: string,
): MarketStream<readonly MarketTrade[]> {
  const { tradingMarket } = useServices();
  const key = `${market}.${symbol}`;
  const snapshot = useQuery({
    queryKey: ['market', 'trades', market, symbol],
    queryFn: ({ signal }) =>
      tradingMarket.getTrades(market, symbol, TRADES_SHOWN, signal),
    staleTime: Infinity,
  });
  const { refetch } = snapshot;
  useOnFeedOpen(() => void refetch());
  const [live, push] = useFrameState<Live<readonly MarketTrade[]>>(() => ({
    key,
    value: [],
    at: null,
  }));

  useEffect(
    () =>
      tradingMarket.subscribeTrades(market, symbol, (trades) =>
        push((current) => ({
          key,
          value: newestFirst(current.key === key ? current.value : [], trades),
          at: Date.now(),
        })),
      ),
    [tradingMarket, market, symbol, key, push],
  );

  const streamed = live.key === key ? live.value : null;
  const value = useMemo(
    () => newestFirst(snapshot.data ?? [], streamed ?? []),
    [snapshot.data, streamed],
  );
  const ready = snapshot.isSuccess || value.length > 0;
  return {
    status: ready ? 'ready' : snapshot.isError ? 'error' : 'loading',
    error: snapshot.error,
    value,
    updatedAt: live.key === key ? live.at : null,
    retry: () => void snapshot.refetch(),
  };
}
