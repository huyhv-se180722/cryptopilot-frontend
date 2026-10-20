// @vitest-environment jsdom
import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../app/providers/query-client';
import { ServicesContext } from '../../../app/providers/services-context';
import type {
  FeedStatus,
  PaperTradingService,
} from '../../../services/api/contracts';
import type { Services } from '../../../services/api/services';
import type { PaperAccountEvent } from '../../../types/domain';
import {
  PAPER_REFRESH_MS,
  PUSH_SETTLE_MS,
  useOpenOrders,
  usePaperPush,
} from './use-paper-orders';

/** A demo account whose pushes and feed status the test drives. */
function setup(initial: FeedStatus) {
  let status = initial;
  const statusListeners = new Set<() => void>();
  let push: ((event: PaperAccountEvent) => void) | null = null;
  const openOrders = vi.fn(async () => []);
  const paperTrading = {
    openAccount: vi.fn(async () => ({
      accountId: 'a-1',
      positionMode: 'one-way',
      openedAt: '2026-10-21T00:00:00Z',
    })),
    openOrders,
    subscribeAccount: (listener: (event: PaperAccountEvent) => void) => {
      push = listener;
      return () => {
        push = null;
      };
    },
    accountFeedStatus: () => status,
    onAccountFeedStatus: (listener: () => void) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  } as unknown as PaperTradingService;
  const client = createQueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => (
    <ServicesContext.Provider value={{ paperTrading } as unknown as Services}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
  return {
    wrapper,
    invalidate,
    openOrders,
    pushed: () => push !== null,
    push: (event: PaperAccountEvent) => act(() => push?.(event)),
    setStatus: (next: FeedStatus) =>
      act(() => {
        status = next;
        statusListeners.forEach((listener) => listener());
      }),
  };
}

const keys = (spy: ReturnType<typeof setup>['invalidate']) =>
  spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));

describe('account pushes on the demo screens (TR-08)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('reads again what pushes changed, close pushes in one go', async () => {
    const run = setup('open');
    renderHook(() => usePaperPush(), { wrapper: run.wrapper });
    await waitFor(() => expect(run.pushed()).toBe(true));
    const order = { orderId: 'o-1' } as never;
    run.push({ kind: 'order', order });
    run.push({ kind: 'fill', fill: { fillId: 'f-1' } as never });
    run.push({ kind: 'balance', balance: { asset: 'BTC' } as never });
    expect(run.invalidate).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(PUSH_SETTLE_MS));
    expect(keys(run.invalidate).sort()).toEqual(
      [
        '["paper","data","open"]',
        '["paper","data","orders"]',
        '["paper","data","fills"]',
        '["paper","data","ledger"]',
        '["paper","data","wallet"]',
        '["paper","data","pnl"]',
        '["paper","data","equity"]',
      ].sort(),
    );
  });

  it('reads everything again once the connection opens after a gap', async () => {
    const run = setup('connecting');
    renderHook(() => usePaperPush(), { wrapper: run.wrapper });
    await waitFor(() => expect(run.pushed()).toBe(true));
    run.setStatus('open');
    expect(keys(run.invalidate)).toEqual(['["paper","data"]']);
    run.setStatus('open');
    expect(run.invalidate).toHaveBeenCalledTimes(1);
  });

  it('reads on a rhythm only while the pushes do not arrive', async () => {
    const run = setup('connecting');
    renderHook(() => useOpenOrders(null), { wrapper: run.wrapper });
    await waitFor(() => expect(run.openOrders).toHaveBeenCalledTimes(1));
    await act(() => vi.advanceTimersByTimeAsync(PAPER_REFRESH_MS));
    expect(run.openOrders).toHaveBeenCalledTimes(2);
    run.setStatus('open');
    await act(() => vi.advanceTimersByTimeAsync(PAPER_REFRESH_MS * 3));
    expect(run.openOrders).toHaveBeenCalledTimes(2);
  });
});
