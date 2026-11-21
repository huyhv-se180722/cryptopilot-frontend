import { describe, expect, it } from 'vitest';
import {
  checkDraft,
  draftOf,
  serverError,
  type ManualDraft,
} from './manual-trade';

const NOW = Date.parse('2026-11-21T00:00:00Z');
const filled = (over: Partial<ManualDraft> = {}): ManualDraft => ({
  ...draftOf(),
  market: 'futures',
  pairId: 'pair-1',
  direction: 'LONG',
  leverage: '5',
  entryPrice: '100',
  quantity: '2',
  entryTime: '2026-11-20T08:00',
  ...over,
});

describe('SCR-22 manual trade form (UC-24)', () => {
  it('asks for the pair, entry price, quantity and entry time', () => {
    const result = checkDraft(draftOf(), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toEqual({
        pairId: 'required',
        entryPrice: 'required',
        quantity: 'required',
        entryTime: 'required',
      });
  });

  it('builds the request of an open Futures trade, decimals as typed', () => {
    const result = checkDraft(
      filled({ fundingFeeAmount: '-1.5', setupDescription: '  ' }),
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      input: expect.objectContaining({
        market: 'futures',
        leverage: 5,
        entryPrice: '100',
        entryTime: new Date('2026-11-20T08:00').toISOString(),
        exitPrice: null,
        exitTime: null,
        fundingFeeAmount: '-1.5',
        setupDescription: null,
      }),
    });
  });

  it('keeps leverage and funding off a Spot trade', () => {
    const result = checkDraft(
      filled({ market: 'spot', fundingFeeAmount: '3' }),
      NOW,
    );
    expect(result.ok && result.input.leverage).toBeNull();
    expect(result.ok && result.input.fundingFeeAmount).toBeNull();
  });

  it('refuses a Spot short, stop loss and take profit on the wrong side (BR-22)', () => {
    const spot = checkDraft(
      filled({ market: 'spot', direction: 'SHORT' }),
      NOW,
    );
    expect(!spot.ok && spot.errors.direction).toBe('spotShort');
    const long = checkDraft(filled({ stopLoss: '110', takeProfit: '90' }), NOW);
    expect(!long.ok && long.errors).toEqual({
      stopLoss: 'side',
      takeProfit: 'side',
    });
    const short = checkDraft(
      filled({ direction: 'SHORT', stopLoss: '110', takeProfit: '90' }),
      NOW,
    );
    expect(short.ok).toBe(true);
  });

  it('wants both exit fields or neither, the exit after the entry and not later than now', () => {
    expect(
      !checkDraft(filled({ exitPrice: '120' }), NOW).ok &&
        (checkDraft(filled({ exitPrice: '120' }), NOW) as { errors: object })
          .errors,
    ).toEqual({ exitTime: 'required' });
    const before = checkDraft(
      filled({ exitPrice: '120', exitTime: '2026-11-20T07:00' }),
      NOW,
    );
    expect(!before.ok && before.errors.exitTime).toBe('exitOrder');
    const future = checkDraft(filled({ entryTime: '2026-12-01T08:00' }), NOW);
    expect(!future.ok && future.errors.entryTime).toBe('future');
  });

  it('refuses zero, negative or malformed amounts and a fractional leverage', () => {
    const result = checkDraft(
      filled({ quantity: '0', feeAmount: '-1', leverage: '2.5' }),
      NOW,
    );
    expect(!result.ok && result.errors).toEqual({
      quantity: 'positive',
      feeAmount: 'positive',
      leverage: 'leverage',
    });
  });

  it('fills the form from a manual trade without the database zeros', () => {
    const draft = draftOf({
      trade: {
        id: 'j-2',
        planId: null,
        pairId: 'pair-1',
        market: 'futures',
        direction: 'SHORT',
        source: 'MANUAL',
        status: 'OPEN',
        leverage: 3,
        entryPrice: '62000.500000000000',
        quantity: '0.100000000000',
        entryTime: '2026-11-10T08:00:00Z',
        entryFee: null,
        stopLoss: null,
        takeProfit: '59000.000000000000',
        exitPrice: null,
        exitTime: null,
        closeReason: null,
        realizedPnl: null,
        feeAmount: null,
        fundingFeeAmount: null,
        netPnl: null,
        provisional: false,
      },
      strategyId: 's-1',
      strategyName: 'Breakout',
      setupDescription: 'Retest',
      lessonsLearned: null,
      mistakes: null,
      chartImageUrl: null,
      chartImageKey: null,
      learning: null,
    });
    expect(draft).toMatchObject({
      leverage: '3',
      entryPrice: '62000.5',
      quantity: '0.1',
      takeProfit: '59000',
      stopLoss: '',
      strategyId: 's-1',
      setupDescription: 'Retest',
    });
  });

  it('reads the server’s field errors', () => {
    expect(serverError('entryPrice', 'MSG01')).toBe('required');
    expect(serverError('stopLoss', 'MSG16')).toBe('side');
    expect(serverError('direction', 'MSG16')).toBe('spotShort');
    expect(serverError('pairId', 'MSG15')).toBe('unknown');
    expect(serverError('exitTime', 'MSG15')).toBe('exitOrder');
    expect(serverError('quantity', 'MSG15')).toBe('range');
  });
});
