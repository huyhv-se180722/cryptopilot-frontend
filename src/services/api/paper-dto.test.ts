import { describe, expect, it } from 'vitest';
import { decodePnlAnalysis } from './paper-dto';

const analysis = (market: unknown) => ({
  market,
  days: 7,
  todayPnl: null,
  cumulativePnl: '0.00000000',
  maxDrawdown: '0.00000000',
  maxDrawdownPercent: null,
  complete: false,
  daily: [],
  trades: {
    closed: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    totalPnl: '0.00000000',
    averageWin: null,
    averageLoss: null,
    profitFactor: null,
  },
});

describe('PnL analysis (TR-28)', () => {
  it('reads the two wallets together, sent as ALL, as no market', () => {
    expect(decodePnlAnalysis(analysis('ALL')).market).toBeNull();
    expect(decodePnlAnalysis(analysis('SPOT')).market).toBe('SPOT');
    expect(decodePnlAnalysis(analysis('FUTURES')).market).toBe('FUTURES');
  });

  it('still refuses a market it does not know', () => {
    expect(() => decodePnlAnalysis(analysis('MARGIN'))).toThrow();
  });
});
