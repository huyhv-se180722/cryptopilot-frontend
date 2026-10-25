import { describe, expect, it } from 'vitest';
import type { TradingPlan } from '../../../types/domain';
import {
  draftOfPlan,
  serverFieldError,
  toInputs,
  type PlanDraft,
} from './plan-form';

const DRAFT: PlanDraft = {
  market: 'spot',
  direction: 'LONG',
  entryType: 'LIMIT',
  entryPrice: '62000',
  stopLoss: '60000',
  takeProfit: '66000',
  riskPercent: '1',
  leverage: '',
  expiry: '',
  note: '',
};
const NOW = Date.parse('2026-10-12T10:00:00Z');

describe('plan form model (SCR-17)', () => {
  it('builds the inputs, leaving empty values to the server defaults', () => {
    const result = toInputs(
      { ...DRAFT, riskPercent: '', note: '  Retest  ' },
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      inputs: {
        market: 'spot',
        direction: 'LONG',
        entryType: 'LIMIT',
        entryPrice: '62000',
        stopLoss: '60000',
        takeProfit: '66000',
        riskPercent: null,
        leverage: null,
        expiresAt: null,
        note: 'Retest',
        invalidationPrice: null,
        maxEntryDeviationR: null,
        analysisTimeframe: null,
      },
    });
  });

  it('checks the BR-22 price order exactly, for both directions', () => {
    expect(
      toInputs({ ...DRAFT, stopLoss: '62000', takeProfit: '61999.99' }, NOW),
    ).toEqual({
      ok: false,
      errors: { stopLoss: { kind: 'order' }, takeProfit: { kind: 'order' } },
    });
    const short = toInputs(
      {
        ...DRAFT,
        market: 'futures',
        direction: 'SHORT',
        leverage: '5',
        stopLoss: '63000',
        takeProfit: '59000',
      },
      NOW,
    );
    expect(short.ok).toBe(true);
    // A MARKET entry is priced by the server, which checks the order.
    expect(
      toInputs(
        { ...DRAFT, entryType: 'MARKET', entryPrice: '', stopLoss: '70000' },
        NOW,
      ).ok,
    ).toBe(true);
  });

  it('checks required fields, numbers, the BR-30 ranges and the expiry', () => {
    const result = toInputs(
      {
        ...DRAFT,
        entryPrice: '',
        stopLoss: 'abc',
        takeProfit: '0',
        riskPercent: '10.5',
        expiry: '2026-10-01T09:00',
        note: 'x'.repeat(1001),
      },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        entryPrice: { kind: 'required' },
        stopLoss: { kind: 'number' },
        takeProfit: { kind: 'positive' },
        riskPercent: { kind: 'range', min: '0.1', max: '10' },
        expiresAt: { kind: 'future' },
        note: { kind: 'tooLong', max: 1000 },
      },
    });
    expect(
      toInputs({ ...DRAFT, market: 'futures', leverage: '0' }, NOW),
    ).toMatchObject({ errors: { leverage: { kind: 'leverage' } } });
    expect(toInputs({ ...DRAFT, direction: 'SHORT' }, NOW)).toMatchObject({
      errors: { direction: { kind: 'required' } },
    });
  });

  it('reads a stored DRAFT without the scale padding', () => {
    const draft = draftOfPlan({
      market: 'spot',
      direction: 'LONG',
      entryType: 'MARKET',
      entryPrice: '62000.000000000000',
      stopLoss: '60000.000000000000',
      takeProfit: '66000.500000000000',
      capital: '1000.00000000',
      riskPercent: '1.000',
      leverage: null,
      expiresAt: null,
      note: null,
    } as unknown as TradingPlan);
    expect(draft).toMatchObject({
      entryPrice: '',
      stopLoss: '60000',
      takeProfit: '66000.5',
      riskPercent: '1',
      expiry: '',
      note: '',
    });
  });

  it('words server field errors with the field’s own rule', () => {
    expect(serverFieldError('stopLoss', 'MSG16')).toEqual({ kind: 'order' });
    expect(serverFieldError('riskPercent', 'MSG15')).toEqual({
      kind: 'range',
      min: '0.1',
      max: '10',
    });
    expect(serverFieldError('entryPrice', 'MSG01')).toEqual({
      kind: 'required',
    });
  });
});
