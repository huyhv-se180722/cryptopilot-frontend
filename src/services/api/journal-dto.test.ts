import { describe, expect, it } from 'vitest';
import { decodeJournalPage } from './journal-dto';

const CLOSED = {
  id: 'j-1',
  planId: 'p-1',
  pairId: 'pair-1',
  market: 'SPOT',
  direction: 'LONG',
  source: 'SIMULATED',
  status: 'CLOSED',
  leverage: null,
  entryPrice: '100.000000000000',
  quantity: '1.000000000000',
  entryTime: '2026-10-20T08:00:00Z',
  entryFee: '0.10000000',
  stopLoss: '90.000000000000',
  takeProfit: '110.000000000000',
  exitPrice: '110.000000000000',
  exitTime: '2026-10-20T09:00:00Z',
  closeReason: 'TAKE_PROFIT',
  realizedPnl: '10.00000000',
  feeAmount: '0.21000000',
  fundingFeeAmount: null,
  netPnl: '9.79000000',
  provisional: false,
};

describe('GET /journal decoder', () => {
  it('reads a closed trade with its amounts and the page', () => {
    const page = decodeJournalPage({
      items: [CLOSED],
      page: 1,
      pageSize: 10,
      total: 1,
    });
    expect(page).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(page.items[0]).toEqual({
      id: 'j-1',
      planId: 'p-1',
      pairId: 'pair-1',
      market: 'spot',
      direction: 'LONG',
      source: 'SIMULATED',
      status: 'CLOSED',
      leverage: null,
      entryPrice: '100.000000000000',
      quantity: '1.000000000000',
      entryTime: '2026-10-20T08:00:00Z',
      exitPrice: '110.000000000000',
      exitTime: '2026-10-20T09:00:00Z',
      closeReason: 'TAKE_PROFIT',
      realizedPnl: '10.00000000',
      feeAmount: '0.21000000',
      fundingFeeAmount: null,
      netPnl: '9.79000000',
      provisional: false,
    });
  });

  it('reads an open manual Futures trade without exit or plan', () => {
    const page = decodeJournalPage({
      items: [
        {
          ...CLOSED,
          planId: null,
          market: 'FUTURES',
          direction: 'SHORT',
          source: 'MANUAL',
          status: 'OPEN',
          leverage: 5,
          exitPrice: null,
          exitTime: null,
          closeReason: null,
          realizedPnl: null,
          feeAmount: null,
          netPnl: null,
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });
    expect(page.items[0]).toMatchObject({
      planId: null,
      market: 'futures',
      leverage: 5,
      status: 'OPEN',
      closeReason: null,
      netPnl: null,
    });
  });

  it('refuses a status it does not know', () => {
    expect(() =>
      decodeJournalPage({
        items: [{ ...CLOSED, status: 'PENDING' }],
        page: 1,
        pageSize: 10,
        total: 1,
      }),
    ).toThrow();
  });
});
