import { describe, expect, it } from 'vitest';
import { decodeFuturesIncomes } from './futures-dto';

describe('Futures balance changes', () => {
  it('reads a transfer, which belongs to no pair, as having no symbol', () => {
    const [transfer, pnl] = decodeFuturesIncomes([
      {
        symbol: '',
        incomeType: 'TRANSFER',
        income: '5000.00000000',
        asset: 'USDT',
        info: 'INITIAL_GRANT',
        time: '2026-10-25T23:58:29.593193Z',
        tranId: 't-1',
        tradeId: null,
      },
      {
        symbol: 'BTCUSDT',
        incomeType: 'REALIZED_PNL',
        income: '-1.5',
        asset: 'USDT',
        info: null,
        time: '2026-10-26T00:00:00Z',
        tranId: 't-2',
      },
    ]);
    expect(transfer?.symbol).toBeNull();
    expect(transfer?.income).toBe('5000.00000000');
    expect(pnl?.symbol).toBe('BTCUSDT');
  });
});
