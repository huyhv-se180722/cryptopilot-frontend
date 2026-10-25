import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/locales/en';
import { ServiceError } from '../../../services/api/errors';
import type { TradingPlan } from '../../../types/domain';
import { activationErrorText, planFieldErrorText } from './plan-errors';

const STOP_PLAN = {
  entryType: 'STOP',
  direction: 'SHORT',
} as TradingPlan;

const refusal = (
  status: number,
  code: string,
  fieldErrors: Record<string, string> = {},
) =>
  new ServiceError('refused', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode: status === 503 ? 'MSG43' : 'MSG01',
    messageArgs: [],
    fieldErrors,
    traceId: 'trace-1',
  });

describe('activation refusals outside the form (SCR-18, D-112)', () => {
  it('words the field the server no longer accepts, with its own MSG16 rule', () => {
    expect(
      activationErrorText(
        en,
        refusal(400, 'VALIDATION_FAILED', { entryPrice: 'MSG16' }),
        STOP_PLAN,
      ),
    ).toBe(
      'For short positions: a stop entry must be below the current price; it has been reached, so use a market entry.',
    );
    expect(
      activationErrorText(
        en,
        refusal(400, 'VALIDATION_FAILED', { invalidationPrice: 'MSG16' }),
        STOP_PLAN,
      ),
    ).toBe(
      'For short positions: the invalidation price must lie beyond the current price, on the far side from the entry.',
    );
    // A MARKET price that moved past the stop keeps the BR-22 rule.
    expect(
      activationErrorText(
        en,
        refusal(400, 'VALIDATION_FAILED', { stopLoss: 'MSG16' }),
        { ...STOP_PLAN, entryType: 'MARKET' },
      ),
    ).toBe('For short positions: take profit < entry price < stop loss.');
  });

  it('says the price is unavailable on a 503, and keeps the general text otherwise', () => {
    expect(
      activationErrorText(
        en,
        refusal(503, 'MARKET_PRICE_UNAVAILABLE'),
        STOP_PLAN,
      ),
    ).toBe('The current price is not available. Try again in a moment.');
    expect(
      activationErrorText(
        en,
        new ServiceError('refused', 'HTTP_ERROR', 409, {
          status: 409,
          code: 'TRADING_BLOCKING_WARNING',
          messageCode: 'MSG18',
          messageArgs: [],
          fieldErrors: {},
        }),
        STOP_PLAN,
      ),
    ).toBe(en.messages.MSG18);
  });
});

describe('leverage refused by the server (BR-26)', () => {
  it('says the maximum depends on the position size, or brackets are missing', () => {
    expect(
      planFieldErrorText(en, { kind: 'leverageMax' }, 'Leverage', 'LONG'),
    ).toBe(
      'Leverage is above the maximum for this position size, or the pair has no leverage brackets yet.',
    );
  });
});
