import { describe, expect, it } from 'vitest';
import { en } from '../../../i18n/locales/en';
import { ServiceError } from '../../../services/api/errors';
import { spotRefusal } from './paper-errors';

const refusal = (status: number, code: string, messageArgs: string[]) =>
  new ServiceError('Refused.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode: status === 409 ? 'MSG43' : 'MSG15',
    messageArgs,
    fieldErrors: {},
  });

describe('Spot order refusals (TR-02 filters, backend 612b201)', () => {
  it('names the limit a symbol filter refused, on its field', () => {
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_PRICE_FILTER', [
          'price',
          '60000.001',
          '0.01',
          'STEP',
        ]),
        'USDT',
      ),
    ).toEqual({ field: 'price', text: 'Enter a multiple of 0.01.' });
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_LOT_SIZE', ['oco.quantity', '9500', '9000', 'MAX']),
        'USDT',
      ),
    ).toEqual({ field: 'oco.quantity', text: 'Enter at most 9,000.' });
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_MARKET_LOT_SIZE', [
          'quantity',
          '0',
          '0.00001',
          'MIN',
        ]),
        'USDT',
      )?.text,
    ).toBe('Enter at least 0.00001.');
  });

  it('says the order value in the quote asset', () => {
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_NOTIONAL', ['quantity', '1.2', '5', 'MIN']),
        'USDT',
      )?.text,
    ).toBe('The order value must be at least 5 USDT.');
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_NOTIONAL', [
          'quoteOrderQty',
          '9e6',
          '9000000',
          'MAX',
        ]),
        'USDT',
      )?.text,
    ).toBe('The order value must be at most 9,000,000 USDT.');
  });

  it('says which side of the last price is too far, and the delta in percent', () => {
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_PERCENT_PRICE', ['price', '1', '12000.5', 'MIN']),
        'USDT',
      )?.text,
    ).toBe('Too far below the last price: enter at least 12,000.5.');
    // The band is last price × multiplier, off the tick: rounded inwards.
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_PERCENT_PRICE', ['price', '1', '40796.005', 'MIN']),
        'USDT',
        '0.01',
      )?.text,
    ).toBe('Too far below the last price: enter at least 40,796.01.');
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_PERCENT_PRICE', [
          'price',
          '9e9',
          '407960.059',
          'MAX',
        ]),
        'USDT',
        '0.01',
      )?.text,
    ).toBe('Too far above the last price: enter at most 407,960.05.');
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_TRAILING_DELTA', [
          'trailingDelta',
          '5',
          '10',
          'MIN',
        ]),
        'USDT',
      )?.text,
    ).toBe('Enter a delta of at least 0.1 %.');
  });

  it('explains the open-order limits of a pair without a field', () => {
    expect(
      spotRefusal(
        en,
        refusal(409, 'PAPER_MAX_NUM_ORDERS', ['orders', '201', '200', 'MAX']),
        'USDT',
      ),
    ).toEqual({
      field: null,
      text: 'You can have at most 200 open orders on this pair. Cancel one first.',
    });
    expect(
      spotRefusal(
        en,
        refusal(409, 'PAPER_MAX_NUM_ALGO_ORDERS', [
          'stopOrders',
          '6',
          '5',
          'MAX',
        ]),
        'USDT',
      )?.text,
    ).toBe(
      'You can have at most 5 open stop orders on this pair. Cancel one first.',
    );
  });

  it('leaves any other refusal, or a malformed one, to the general text', () => {
    expect(
      spotRefusal(en, refusal(400, 'PAPER_INSUFFICIENT_BALANCE', []), 'USDT'),
    ).toBeUndefined();
    expect(
      spotRefusal(
        en,
        refusal(400, 'PAPER_LOT_SIZE', ['quantity', '1', '2', 'SOMETIMES']),
        'USDT',
      ),
    ).toBeUndefined();
    expect(spotRefusal(en, new Error('offline'), 'USDT')).toBeUndefined();
  });
});
