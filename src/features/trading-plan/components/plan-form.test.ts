import { describe, expect, it } from 'vitest';
import type { TradingPlan } from '../../../types/domain';
import {
  draftOfPlan,
  serverFieldError,
  timeframeOfStyle,
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
  capital: '1000',
  riskPercent: '1',
  leverage: '',
  expiry: '',
  note: '',
  invalidationPrice: '',
  maxEntryDeviationR: '',
  analysisTimeframe: '1h',
};
const NOW = Date.parse('2026-10-12T10:00:00Z');

describe('plan form model (SCR-17)', () => {
  it('builds the inputs, leaving empty values to the server defaults', () => {
    const result = toInputs(
      { ...DRAFT, capital: ' ', riskPercent: '', note: '  Retest  ' },
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
        capital: null,
        riskPercent: null,
        leverage: null,
        expiresAt: null,
        note: 'Retest',
        invalidationPrice: null,
        maxEntryDeviationR: null,
        analysisTimeframe: '1h',
      },
    });
  });

  it('prices a STOP entry like a limit and orders its exits by the stop (D-111)', () => {
    const stop = toInputs(
      {
        ...DRAFT,
        entryType: 'STOP',
        entryPrice: '70000',
        stopLoss: '68000',
        takeProfit: '76000',
      },
      NOW,
    );
    expect(stop).toMatchObject({
      ok: true,
      inputs: { entryType: 'STOP', entryPrice: '70000' },
    });
    // 66000 is under the stop of 70000: no longer a take profit for a long.
    expect(
      toInputs(
        {
          ...DRAFT,
          entryType: 'STOP',
          entryPrice: '70000',
          stopLoss: '68000',
          takeProfit: '66000',
        },
        NOW,
      ),
    ).toEqual({ ok: false, errors: { takeProfit: { kind: 'order' } } });
    expect(
      toInputs({ ...DRAFT, entryType: 'STOP', entryPrice: '' }, NOW),
    ).toEqual({ ok: false, errors: { entryPrice: { kind: 'required' } } });
  });

  it('sends the invalidation price of a LIMIT or STOP only, and checks the deviation limit (BR-68, BR-69)', () => {
    expect(
      toInputs({ ...DRAFT, invalidationPrice: ' 64000 ' }, NOW),
    ).toMatchObject({ ok: true, inputs: { invalidationPrice: '64000' } });
    // A market entry has none: a value left in the field is not sent.
    expect(
      toInputs(
        { ...DRAFT, entryType: 'MARKET', invalidationPrice: '64000' },
        NOW,
      ),
    ).toMatchObject({ ok: true, inputs: { invalidationPrice: null } });
    expect(toInputs({ ...DRAFT, invalidationPrice: '0' }, NOW)).toEqual({
      ok: false,
      errors: { invalidationPrice: { kind: 'positive' } },
    });
    expect(
      toInputs({ ...DRAFT, maxEntryDeviationR: '0.75' }, NOW),
    ).toMatchObject({ ok: true, inputs: { maxEntryDeviationR: '0.75' } });
    for (const value of ['0', '0.7500001', '1'])
      expect(toInputs({ ...DRAFT, maxEntryDeviationR: value }, NOW)).toEqual({
        ok: false,
        errors: { maxEntryDeviationR: { kind: 'deviation', max: '0.75' } },
      });
    expect(toInputs({ ...DRAFT, maxEntryDeviationR: 'half' }, NOW)).toEqual({
      ok: false,
      errors: { maxEntryDeviationR: { kind: 'number' } },
    });
  });

  it('leaves the analysis timeframe to the server when none is chosen', () => {
    expect(toInputs({ ...DRAFT, analysisTimeframe: '' }, NOW)).toMatchObject({
      ok: true,
      inputs: { analysisTimeframe: null },
    });
    expect(timeframeOfStyle('SCALPING')).toBe('15m');
    expect(timeframeOfStyle('DAY')).toBe('1h');
    expect(timeframeOfStyle('SWING')).toBe('4h');
    expect(timeframeOfStyle('POSITION')).toBe('4h');
    expect(timeframeOfStyle(null)).toBe('1h');
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
        capital: '0',
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
        capital: { kind: 'positive' },
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
      invalidationPrice: null,
      maxEntryDeviationR: '0.500000000000',
      analysisTimeframe: '4h',
    } as unknown as TradingPlan);
    expect(draft).toMatchObject({
      entryPrice: '',
      stopLoss: '60000',
      takeProfit: '66000.5',
      capital: '1000',
      riskPercent: '1',
      expiry: '',
      note: '',
      invalidationPrice: '',
      maxEntryDeviationR: '0.5',
      analysisTimeframe: '4h',
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
    // MSG16 names a different rule on each field (D-112).
    expect(serverFieldError('invalidationPrice', 'MSG16')).toEqual({
      kind: 'invalidationSide',
    });
    expect(serverFieldError('entryPrice', 'MSG16')).toEqual({
      kind: 'stopReached',
    });
    expect(serverFieldError('maxEntryDeviationR', 'MSG15')).toEqual({
      kind: 'deviation',
      max: '0.75',
    });
  });
});
