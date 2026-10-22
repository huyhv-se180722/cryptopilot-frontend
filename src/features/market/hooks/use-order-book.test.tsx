// @vitest-environment jsdom
import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../app/providers/query-client';
import { ServicesContext } from '../../../app/providers/services-context';
import type {
  FeedStatus,
  MarketFeed,
  TradingMarketService,
} from '../../../services/api/contracts';
import { integrationPending } from '../../../services/api/errors';
import type { Services } from '../../../services/api/services';
import type { MarketTrade, OrderBook } from '../../../types/domain';
import {
  TRADES_READ,
  TRADES_SHOWN,
  useMarketTrades,
  useOrderBook,
} from './use-order-book';

const book = (id: number, best: string): OrderBook => ({
  market: 'spot',
  symbol: 'BTCUSDT',
  lastUpdateId: id,
  receivedAt: '2026-10-13T00:00:00Z',
  bids: [{ price: best, quantity: '1.5' }],
  asks: [{ price: '63001.00', quantity: '0.2' }],
});
const trade = (id: number): MarketTrade => ({
  id,
  price: '63000.00',
  quantity: '0.01',
  time: '2026-10-13T00:00:00Z',
  buyerMaker: id % 2 === 0,
});

function setup(service: Partial<TradingMarketService>) {
  let depth: ((value: OrderBook) => void) | null = null;
  let trades: ((value: readonly MarketTrade[]) => void) | null = null;
  const tradingMarket: TradingMarketService = {
    getDepth: vi.fn(async () => book(10, '63000.00')),
    getTrades: vi.fn(async () =>
      Array.from({ length: TRADES_READ }, (_, i) => trade(100 - i)),
    ),
    subscribeDepth: (_m, _s, listener) => {
      depth = listener;
      return () => {
        depth = null;
      };
    },
    subscribeTrades: (_m, _s, listener) => {
      trades = listener;
      return () => {
        trades = null;
      };
    },
    ...service,
  };
  // The topics ride on the market feed's connection, whose status is shared.
  let status: FeedStatus = 'open';
  const statusListeners = new Set<() => void>();
  const marketFeed = {
    status: () => status,
    onStatus: (listener: () => void) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  } as unknown as MarketFeed;
  const setStatus = (next: FeedStatus) =>
    act(() => {
      status = next;
      statusListeners.forEach((listener) => listener());
    });
  const client = createQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <ServicesContext.Provider
      value={{ tradingMarket, marketFeed } as unknown as Services}
    >
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
  return {
    wrapper,
    tradingMarket,
    pushDepth: (value: OrderBook) => act(() => depth?.(value)),
    pushTrades: (value: readonly MarketTrade[]) => act(() => trades?.(value)),
    setStatus,
  };
}

describe('useOrderBook (TR-03)', () => {
  it('starts from the stored book, takes newer books and skips older ones', async () => {
    const { wrapper, pushDepth } = setup({});
    const { result } = renderHook(() => useOrderBook('spot', 'BTCUSDT'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.value?.lastUpdateId).toBe(10);
    expect(result.current.updatedAt).toBeNull();
    // A burst within one frame: the newest wins, an older one is ignored.
    pushDepth(book(12, '63000.50'));
    pushDepth(book(11, '62999.00'));
    pushDepth(book(13, '63000.75'));
    pushDepth(book(9, '62000.00'));
    await waitFor(() => expect(result.current.value?.lastUpdateId).toBe(13));
    expect(result.current.value?.bids[0]?.price).toBe('63000.75');
    expect(result.current.updatedAt).not.toBeNull();
  });

  it('reports NOT_CONFIGURED while depth is not on the backend develop', async () => {
    const { wrapper } = setup({ getDepth: async () => integrationPending() });
    const { result } = renderHook(() => useOrderBook('spot', 'BTCUSDT'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatchObject({ code: 'NOT_CONFIGURED' });
  });
});

describe('useMarketTrades (TR-03)', () => {
  it('reads 50, keeps the newest 100 as pushes come, newest first, once per trade id', async () => {
    const { wrapper, pushTrades, tradingMarket } = setup({});
    const { result } = renderHook(() => useMarketTrades('spot', 'BTCUSDT'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.value).toHaveLength(50));
    expect(result.current.value[0]?.id).toBe(100);
    pushTrades([trade(100), trade(101), trade(102)]);
    pushTrades([trade(103)]);
    await waitFor(() => expect(result.current.value[0]?.id).toBe(103));
    expect(result.current.value.map((t) => t.id).slice(0, 5)).toEqual([
      103, 102, 101, 100, 99,
    ]);
    expect(result.current.value).toHaveLength(TRADES_READ + 3);
    expect(tradingMarket.getTrades).toHaveBeenCalledWith(
      'spot',
      'BTCUSDT',
      TRADES_READ,
      expect.anything(),
    );
    pushTrades(Array.from({ length: 60 }, (_, i) => trade(104 + i)));
    await waitFor(() => expect(result.current.value[0]?.id).toBe(163));
    expect(result.current.value).toHaveLength(TRADES_SHOWN);
  });

  it('reads the stored trades again after a reconnect, filling the gap', async () => {
    let stored = Array.from({ length: TRADES_READ }, (_, i) => trade(100 - i));
    const getTrades = vi.fn(async () => stored);
    const { wrapper, setStatus } = setup({ getTrades });
    const { result } = renderHook(() => useMarketTrades('spot', 'BTCUSDT'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.value[0]?.id).toBe(100));
    const reads = getTrades.mock.calls.length;

    // Down while trades 101…104 happen, then open again.
    setStatus('connecting');
    stored = Array.from({ length: TRADES_READ }, (_, i) => trade(104 - i));
    setStatus('open');
    await waitFor(() => expect(result.current.value[0]?.id).toBe(104));
    expect(getTrades.mock.calls.length).toBe(reads + 1);
    expect(result.current.value.map((t) => t.id).slice(0, 5)).toEqual([
      104, 103, 102, 101, 100,
    ]);
  });
});
