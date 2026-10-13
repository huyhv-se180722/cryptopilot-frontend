import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareDecimal } from '../utils/decimal-format';
import { createDevelopmentMarket } from './dev-market';

afterEach(() => vi.useRealTimers());

describe('development depth and trades (TR-03 shapes)', () => {
  it('serves 20 levels a side, best first, and newer books on the topic', async () => {
    vi.useFakeTimers();
    const { tradingMarket } = createDevelopmentMarket();
    const first = await tradingMarket.getDepth('spot', 'BTCUSDT');
    expect(first.bids).toHaveLength(20);
    expect(first.asks).toHaveLength(20);
    const descending = first.bids.every(
      (level, i, all) =>
        i === 0 || compareDecimal(all[i - 1]!.price, level.price) > 0,
    );
    const ascending = first.asks.every(
      (level, i, all) =>
        i === 0 || compareDecimal(all[i - 1]!.price, level.price) < 0,
    );
    expect(descending && ascending).toBe(true);
    expect(
      compareDecimal(first.bids[0]!.price, first.asks[0]!.price),
    ).toBeLessThan(0);
    const books: number[] = [];
    const stop = tradingMarket.subscribeDepth('spot', 'BTCUSDT', (book) =>
      books.push(book.lastUpdateId ?? 0),
    );
    vi.advanceTimersByTime(900);
    stop();
    vi.advanceTimersByTime(900);
    expect(books).toHaveLength(3);
    expect(books[0]).toBeGreaterThan(first.lastUpdateId ?? 0);
  });

  it('serves the latest trades newest first and refuses a pair not enabled', async () => {
    const { tradingMarket } = createDevelopmentMarket();
    const trades = await tradingMarket.getTrades('spot', 'ETHUSDT', 50);
    expect(trades).toHaveLength(50);
    expect(trades[0]!.id).toBeGreaterThan(trades[49]!.id);
    await expect(
      tradingMarket.getDepth('spot', 'XYZUSDT'),
    ).rejects.toMatchObject({ problem: { messageCode: 'MSG41' } });
  });
});
