import { describe, expect, it, vi } from 'vitest';
import { createPendingTradingMarketService } from './trading-market';

describe('trading market data (TR-03)', () => {
  it('is pending until the backend merges depth and trades', async () => {
    const service = createPendingTradingMarketService();
    await expect(service.getDepth('spot', 'BTCUSDT')).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
    await expect(
      service.getTrades('spot', 'BTCUSDT', 50),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    const listener = vi.fn();
    service.subscribeDepth('spot', 'BTCUSDT', listener)();
    service.subscribeTrades('spot', 'BTCUSDT', listener)();
    expect(listener).not.toHaveBeenCalled();
  });
});
