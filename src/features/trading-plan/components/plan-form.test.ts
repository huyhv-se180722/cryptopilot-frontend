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
  riskPercent: '1',
  leverage: '',
  expiry: '',
  note: '',
  invalidationPrice: '',
  maxEntryDeviation: '',
  timeframe: '',
};
const NOW = Date.parse('2026-10-12T10:00:00Z');
const errorsOf = (draft: Partial<PlanDraft>) => {
  const result = toInputs({ ...DRAFT, ...draft }, NOW);
  return result.ok ? {} : result.errors;
};

describe('plan form model (SCR-17)', () => {
  it('builds the inputs, leaving empty values to the server defaults', () => {
    const result = toInputs(
      { ...DRAFT, riskPercent: '', note: '  Retest  ' },
      NOW,
      '4h',
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
        // The style's default, while the Trader picked none.
        analysisTimeframe: '4h',
      },
    });
    expect(result).not.toHaveProperty('inputs.capital');
  });

  it('checks the BR-22 price order exactly, for both directions', () => {
    expect(errorsOf({ stopLoss: '62000', takeProfit: '61999.99' })).toEqual({
      stopLoss: { kind: 'rule', rule: 'orderLONG' },
      takeProfit: { kind: 'rule', rule: 'orderLONG' },
    });
    expect(errorsOf({ stopLoss: '61999.99', takeProfit: '62000.01' })).toEqual(
      {},
    );
    const short = {
      market: 'futures',
      direction: 'SHORT',
      leverage: '5',
    } as const;
    expect(
      errorsOf({ ...short, stopLoss: '61000', takeProfit: '63000' }),
    ).toEqual({
      stopLoss: { kind: 'rule', rule: 'orderSHORT' },
      takeProfit: { kind: 'rule', rule: 'orderSHORT' },
    });
    expect(
      errorsOf({ ...short, stopLoss: '63000', takeProfit: '61000' }),
    ).toEqual({});
  });

  it('checks every field and names its rule', () => {
    expect(
      errorsOf({
        entryPrice: '',
        stopLoss: 'abc',
        takeProfit: '0',
        riskPercent: '10.5',
        expiry: '2026-10-01T09:00',
        note: 'x'.repeat(1001),
      }),
    ).toEqual({
      entryPrice: { kind: 'required' },
      stopLoss: { kind: 'number' },
      takeProfit: { kind: 'positive' },
      riskPercent: { kind: 'range', min: '0.1', max: '10' },
      expiresAt: { kind: 'future' },
      note: { kind: 'tooLong', max: 1000 },
    });
    expect(errorsOf({ riskPercent: '0.1' })).toEqual({});
    expect(errorsOf({ riskPercent: '10' })).toEqual({});
    expect(errorsOf({ riskPercent: '0.099' })).toMatchObject({
      riskPercent: { kind: 'range' },
    });
    expect(errorsOf({ note: 'x'.repeat(1000) })).toEqual({});
    expect(errorsOf({ market: 'futures', leverage: '0' })).toEqual({
      leverage: { kind: 'leverage' },
    });
    expect(errorsOf({ market: 'futures', leverage: '' })).toEqual({
      leverage: { kind: 'required' },
    });
    expect(errorsOf({ market: 'futures', leverage: '20' })).toEqual({});
    expect(
      errorsOf({ direction: 'SHORT', stopLoss: '64000', takeProfit: '60000' }),
    ).toEqual({
      direction: { kind: 'required' },
    });
  });

  it('takes the stop price as the entry of a STOP and orders it like a limit', () => {
    const stop = { entryType: 'STOP', entryPrice: '64000' } as const;
    expect(
      errorsOf({ ...stop, stopLoss: '63000', takeProfit: '67000' }),
    ).toEqual({});
    expect(
      errorsOf({
        ...stop,
        entryPrice: '',
        stopLoss: '63000',
        takeProfit: '67000',
      }),
    ).toEqual({ entryPrice: { kind: 'required' } });
    expect(
      errorsOf({ ...stop, stopLoss: '65000', takeProfit: '67000' }),
    ).toEqual({ stopLoss: { kind: 'rule', rule: 'orderLONG' } });
    const result = toInputs(
      { ...DRAFT, ...stop, stopLoss: '63000', takeProfit: '67000' },
      NOW,
    );
    expect(result).toMatchObject({
      ok: true,
      inputs: { entryType: 'STOP', entryPrice: '64000' },
    });
  });

  it('leaves a MARKET entry and its invalidation price to the server', () => {
    const result = toInputs(
      {
        ...DRAFT,
        entryType: 'MARKET',
        entryPrice: 'ignored',
        invalidationPrice: '70000',
      },
      NOW,
    );
    expect(result).toMatchObject({
      ok: true,
      inputs: { entryPrice: null, invalidationPrice: null },
    });
  });

  it.each([
    // direction, entry type, a wrong side, a right side
    ['LONG', 'LIMIT', '61000', '63000'],
    ['LONG', 'STOP', '62500', '61000'],
    ['SHORT', 'LIMIT', '62500', '61000'],
    ['SHORT', 'STOP', '61000', '63000'],
  ] as const)(
    'puts the invalidation price of a %s %s on the far side of the entry',
    (direction, entryType, wrong, right) => {
      const base = {
        market: 'futures',
        leverage: '5',
        direction,
        entryType,
        entryPrice: '62000',
        stopLoss: direction === 'LONG' ? '60000' : '64000',
        takeProfit: direction === 'LONG' ? '66000' : '58000',
      } as const;
      expect(errorsOf({ ...base, invalidationPrice: wrong })).toEqual({
        invalidationPrice: {
          kind: 'rule',
          rule: `invalidation${direction}${entryType}`,
        },
      });
      // Equal to the entry is the wrong side too.
      expect(errorsOf({ ...base, invalidationPrice: '62000' })).toMatchObject({
        invalidationPrice: { kind: 'rule' },
      });
      expect(errorsOf({ ...base, invalidationPrice: right })).toEqual({});
    },
  );

  it('checks the invalidation price as a price', () => {
    expect(errorsOf({ invalidationPrice: 'x' })).toEqual({
      invalidationPrice: { kind: 'number' },
    });
    expect(errorsOf({ invalidationPrice: '0' })).toEqual({
      invalidationPrice: { kind: 'positive' },
    });
  });

  it('keeps the entry deviation limit above 0 and at most 0.75 R', () => {
    expect(errorsOf({ maxEntryDeviation: '0' })).toEqual({
      maxEntryDeviationR: { kind: 'positive' },
    });
    expect(errorsOf({ maxEntryDeviation: '0.76' })).toEqual({
      maxEntryDeviationR: { kind: 'range', min: '0', max: '0.75' },
    });
    expect(errorsOf({ maxEntryDeviation: 'abc' })).toEqual({
      maxEntryDeviationR: { kind: 'number' },
    });
    expect(errorsOf({ maxEntryDeviation: '0.01' })).toEqual({});
    expect(errorsOf({ maxEntryDeviation: '0.75' })).toEqual({});
    expect(toInputs({ ...DRAFT, maxEntryDeviation: '0.5' }, NOW)).toMatchObject(
      { inputs: { maxEntryDeviationR: '0.5' } },
    );
  });

  it('defaults the analysis timeframe from the trading style', () => {
    expect(timeframeOfStyle('SCALPING')).toBe('15m');
    expect(timeframeOfStyle('DAY')).toBe('1h');
    expect(timeframeOfStyle('SWING')).toBe('4h');
    expect(timeframeOfStyle('POSITION')).toBe('4h');
    expect(timeframeOfStyle(null)).toBe('1h');
    // A timeframe the Trader picked wins over the style's.
    expect(toInputs({ ...DRAFT, timeframe: '1d' }, NOW, '15m')).toMatchObject({
      inputs: { analysisTimeframe: '1d' },
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
      riskPercent: '1.000',
      leverage: null,
      expiresAt: null,
      note: null,
      invalidationPrice: null,
      maxEntryDeviationR: '0.50',
      analysisTimeframe: '4h',
    } as unknown as TradingPlan);
    expect(draft).toMatchObject({
      entryPrice: '',
      stopLoss: '60000',
      takeProfit: '66000.5',
      riskPercent: '1',
      expiry: '',
      note: '',
      invalidationPrice: '',
      maxEntryDeviation: '0.5',
      timeframe: '4h',
    });
    expect(
      draftOfPlan({
        entryType: 'STOP',
        entryPrice: '64000.000000000000',
        stopLoss: '1',
        takeProfit: '1',
        riskPercent: '1',
        leverage: null,
        expiresAt: null,
        note: null,
        invalidationPrice: '61000.000000000000',
        maxEntryDeviationR: null,
        analysisTimeframe: '1h',
      } as unknown as TradingPlan),
    ).toMatchObject({ entryPrice: '64000', invalidationPrice: '61000' });
  });

  it('words server field errors with the field’s own rule', () => {
    const long = { direction: 'LONG', entryType: 'LIMIT' } as const;
    expect(serverFieldError('stopLoss', 'MSG16', long)).toEqual({
      kind: 'rule',
      rule: 'orderLONG',
    });
    expect(serverFieldError('riskPercent', 'MSG15', long)).toEqual({
      kind: 'range',
      min: '0.1',
      max: '10',
    });
    expect(serverFieldError('entryPrice', 'MSG01', long)).toEqual({
      kind: 'required',
    });
    expect(serverFieldError('leverage', 'MSG15', long)).toEqual({
      kind: 'leverageBracket',
    });
    expect(serverFieldError('maxEntryDeviationR', 'MSG15', long)).toEqual({
      kind: 'range',
      min: '0',
      max: '0.75',
    });
    // M-11: the client fills {rule} from direction and entry type.
    expect(
      serverFieldError('invalidationPrice', 'MSG16', {
        direction: 'SHORT',
        entryType: 'STOP',
      }),
    ).toEqual({ kind: 'rule', rule: 'invalidationSHORTSTOP' });
    // TP-B: on an activation, a level the price already reached.
    expect(serverFieldError('stopLoss', 'MSG16', long, true)).toEqual({
      kind: 'rule',
      rule: 'reachedStopLossLONG',
    });
    expect(serverFieldError('takeProfit', 'MSG16', long, true)).toEqual({
      kind: 'rule',
      rule: 'reachedTakeProfitLONG',
    });
    expect(
      serverFieldError(
        'entryPrice',
        'MSG16',
        { direction: 'SHORT', entryType: 'STOP' },
        true,
      ),
    ).toEqual({ kind: 'rule', rule: 'reachedStopSHORT' });
  });
});
