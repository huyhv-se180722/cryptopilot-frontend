import { describe, expect, it } from 'vitest';
import type { MarketPair } from '../../../types/domain';
import {
  amountOf,
  checkSpotOrder,
  EMPTY_DRAFT,
  maxOrder,
  pickedPrice,
  shareInUse,
  shareOfFunds,
  stopTypeFor,
  totalOf,
  type SpotOrderDraft,
} from './spot-order';

const BTC: MarketPair = {
  pairId: 'p-btc',
  symbol: 'BTCUSDT',
  market: 'spot',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  baseAssetName: 'Bitcoin',
  logoUrl: null,
  tickSize: '0.01',
  stepSize: '0.00001',
  minNotional: '5',
  displayOrder: 1,
};
const FUNDS = { quote: '1000', base: '0.1' };
const draft = (over: Partial<SpotOrderDraft> = {}): SpotOrderDraft => ({
  ...EMPTY_DRAFT,
  price: '60000',
  amount: '0.01',
  ...over,
});
const orderOf = (check: ReturnType<typeof checkSpotOrder>) =>
  check.request?.kind === 'order' ? check.request.order : null;
const listOf = (check: ReturnType<typeof checkSpotOrder>) =>
  check.request?.kind === 'list' ? check.request.list : null;

describe('Spot order check (TR-F3)', () => {
  it('builds a LIMIT buy on the tick and step with its notional', () => {
    const check = checkSpotOrder(
      draft({ price: '60000.019', amount: '0.0100099' }),
      BTC,
      FUNDS,
      null,
    );
    expect(check.errors).toEqual({});
    expect(orderOf(check)).toEqual({
      side: 'BUY',
      type: 'LIMIT',
      timeInForce: 'GTC',
      price: '60000.01',
      quantity: '0.01000',
    });
    expect(check.notional).toBe('600.0001');
  });

  it('rounds a sell price up, never below what was typed', () => {
    const check = checkSpotOrder(
      draft({ side: 'SELL', price: '60000.011', amount: '0.05' }),
      BTC,
      FUNDS,
      null,
    );
    expect(orderOf(check)?.price).toBe('60000.02');
  });

  it('sends a post-only limit as a LIMIT_MAKER, without a time in force', () => {
    expect(
      orderOf(checkSpotOrder(draft({ postOnly: true }), BTC, FUNDS, null)),
    ).toEqual({
      side: 'BUY',
      type: 'LIMIT_MAKER',
      price: '60000.00',
      quantity: '0.01000',
    });
  });

  it('refuses missing, invalid, too small, below-step and unaffordable orders', () => {
    expect(
      checkSpotOrder(draft({ price: '' }), BTC, FUNDS, null).errors,
    ).toEqual({ price: 'required' });
    expect(
      checkSpotOrder(draft({ amount: '-1' }), BTC, FUNDS, null).errors,
    ).toEqual({ amount: 'invalid' });
    expect(
      checkSpotOrder(draft({ amount: '0.000001' }), BTC, FUNDS, null).errors,
    ).toEqual({ amount: 'belowStep' });
    expect(
      checkSpotOrder(draft({ amount: '0.00008' }), BTC, FUNDS, null).errors,
    ).toEqual({ amount: 'minNotional' });
    expect(
      checkSpotOrder(draft({ amount: '0.02' }), BTC, FUNDS, null).errors,
    ).toEqual({ amount: 'insufficient' });
    expect(
      checkSpotOrder(draft({ side: 'SELL', amount: '0.2' }), BTC, FUNDS, null)
        .errors,
    ).toEqual({ amount: 'insufficient' });
  });

  it('places a MARKET order by total on both sides', () => {
    const market = draft({
      type: 'MARKET',
      byTotal: true,
      total: '250.123456789',
    });
    expect(orderOf(checkSpotOrder(market, BTC, FUNDS, '60000'))).toEqual({
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: '250.12345678',
    });
    expect(
      checkSpotOrder({ ...market, total: '1001' }, BTC, FUNDS, '60000').errors,
    ).toEqual({ total: 'insufficient' });
    expect(
      orderOf(
        checkSpotOrder(
          { ...market, side: 'SELL', total: '600' },
          BTC,
          FUNDS,
          '60000',
        ),
      ),
    ).toEqual({ side: 'SELL', type: 'MARKET', quoteOrderQty: '600.00000000' });
    expect(
      checkSpotOrder(
        { ...market, side: 'SELL', total: '6001' },
        BTC,
        FUNDS,
        '60000',
      ).errors,
    ).toEqual({ total: 'insufficient' });
  });

  it('picks the exchange stop type by where the stop lies against the last price', () => {
    expect(stopTypeFor('BUY', '61000', '60000', true)).toBe('STOP_LOSS_LIMIT');
    expect(stopTypeFor('BUY', '59000', '60000', true)).toBe(
      'TAKE_PROFIT_LIMIT',
    );
    expect(stopTypeFor('SELL', '59000', '60000', false)).toBe('STOP_LOSS');
    expect(stopTypeFor('SELL', '61000', '60000', false)).toBe('TAKE_PROFIT');
    expect(stopTypeFor('SELL', '60000', '60000', true)).toBeNull();
  });

  it('sends a Stop Limit and a Stop Market as the exchange stop types', () => {
    expect(
      orderOf(
        checkSpotOrder(
          draft({ type: 'STOP_LIMIT', stop: '61000', price: '61100.00' }),
          BTC,
          { quote: '1000', base: '0.1' },
          '60000',
        ),
      ),
    ).toEqual({
      side: 'BUY',
      type: 'STOP_LOSS_LIMIT',
      timeInForce: 'GTC',
      price: '61100.00',
      stopPrice: '61000.00',
      quantity: '0.01000',
    });
    expect(
      orderOf(
        checkSpotOrder(
          draft({
            type: 'STOP_MARKET',
            side: 'SELL',
            stop: '59000',
            price: '',
          }),
          BTC,
          FUNDS,
          '60000',
        ),
      ),
    ).toEqual({
      side: 'SELL',
      type: 'STOP_LOSS',
      stopPrice: '59000.00',
      quantity: '0.01000',
    });
    expect(
      checkSpotOrder(
        draft({ type: 'STOP_MARKET', stop: '60000' }),
        BTC,
        FUNDS,
        '60000',
      ).errors,
    ).toEqual({ stop: 'atLastPrice' });
    expect(
      checkSpotOrder(
        draft({ type: 'STOP_MARKET', stop: '61000' }),
        BTC,
        FUNDS,
        null,
      ).errors,
    ).toEqual({ stop: 'noLastPrice' });
  });

  it('sends a trailing stop with its delta in basis points', () => {
    expect(
      orderOf(
        checkSpotOrder(
          draft({
            type: 'TRAILING',
            side: 'SELL',
            trailing: '1.5',
            price: '58000.00',
          }),
          BTC,
          FUNDS,
          '60000',
        ),
      ),
    ).toEqual({
      side: 'SELL',
      type: 'STOP_LOSS_LIMIT',
      timeInForce: 'GTC',
      price: '58000.00',
      trailingDelta: 150,
      quantity: '0.01000',
    });
    // An activation price above the price on a sale is a take profit.
    expect(
      orderOf(
        checkSpotOrder(
          draft({
            type: 'TRAILING',
            side: 'SELL',
            trailing: '2',
            stop: '62000',
            price: '61000',
          }),
          BTC,
          FUNDS,
          '60000',
        ),
      ),
    ).toMatchObject({
      type: 'TAKE_PROFIT_LIMIT',
      stopPrice: '62000.00',
      trailingDelta: 200,
    });
    expect(
      checkSpotOrder(
        draft({ type: 'TRAILING', trailing: '25' }),
        BTC,
        FUNDS,
        '60000',
      ).errors,
    ).toEqual({ trailing: 'trailingRange' });
    // An activation at the last price would trigger at once: not sent.
    const atLast = checkSpotOrder(
      draft({
        type: 'TRAILING',
        side: 'SELL',
        trailing: '1',
        stop: '60000',
        price: '59000',
      }),
      BTC,
      FUNDS,
      '60000',
    );
    expect(atLast.errors).toEqual({ stop: 'atLastPrice' });
    expect(atLast.request).toBeNull();
  });

  it('sends an OCO with its prices around the last price, the stop limit optional', () => {
    expect(
      listOf(
        checkSpotOrder(
          draft({ type: 'OCO', side: 'SELL', price: '62000', stop: '58000' }),
          BTC,
          FUNDS,
          '60000',
        ),
      ),
    ).toEqual({
      type: 'OCO',
      oco: {
        side: 'SELL',
        quantity: '0.01000',
        takeProfitPrice: '62000.00',
        stopPrice: '58000.00',
      },
    });
    expect(
      checkSpotOrder(
        draft({ type: 'OCO', side: 'SELL', price: '59000', stop: '61000' }),
        BTC,
        FUNDS,
        '60000',
      ).errors,
    ).toEqual({ price: 'priceOrder', stop: 'priceOrder' });
  });

  it('sends a limit with TP/SL as an OTOCO, its quantity left to the backend', () => {
    expect(
      listOf(
        checkSpotOrder(
          draft({ tpsl: true, takeProfit: '63000', stopLoss: '58000' }),
          BTC,
          FUNDS,
          '60500',
        ),
      ),
    ).toEqual({
      type: 'OTOCO',
      working: {
        side: 'BUY',
        type: 'LIMIT',
        price: '60000.00',
        quantity: '0.01000',
      },
      oco: {
        side: 'SELL',
        takeProfitPrice: '63000.00',
        stopPrice: '58000.00',
      },
    });
    expect(
      checkSpotOrder(
        draft({ tpsl: true, takeProfit: '59000', stopLoss: '61000' }),
        BTC,
        FUNDS,
        null,
      ).errors,
    ).toEqual({ takeProfit: 'priceOrder', stopLoss: 'priceOrder' });
  });

  it('puts the TP/SL of a buy on the tick as the sells they are', () => {
    const list = listOf(
      checkSpotOrder(
        draft({
          price: '60000.019',
          tpsl: true,
          takeProfit: '63000.001',
          stopLoss: '58000.001',
        }),
        BTC,
        FUNDS,
        '60500',
      ),
    );
    // The working buy rounds down; its take profit and stop loss round up.
    expect(list?.working?.price).toBe('60000.01');
    expect(list?.oco).toMatchObject({
      takeProfitPrice: '63000.01',
      stopPrice: '58000.01',
    });
    const sell = listOf(
      checkSpotOrder(
        draft({
          side: 'SELL',
          price: '60000.011',
          amount: '0.05',
          tpsl: true,
          takeProfit: '57000.019',
          stopLoss: '62000.019',
        }),
        BTC,
        FUNDS,
        '59500',
      ),
    );
    expect(sell?.working?.price).toBe('60000.02');
    expect(sell?.oco).toMatchObject({
      side: 'BUY',
      takeProfitPrice: '57000.01',
      stopPrice: '62000.01',
    });
  });

  it('fills the amount from a share of the free balance', () => {
    expect(shareOfFunds(draft(), BTC, FUNDS, 25, null)).toEqual({
      amount: '0.00416',
      total: '249.60',
    });
    expect(shareOfFunds(draft({ side: 'SELL' }), BTC, FUNDS, 50, null)).toEqual(
      { amount: '0.05000', total: '3000.00' },
    );
    expect(
      shareOfFunds(
        draft({ type: 'MARKET', byTotal: true }),
        BTC,
        FUNDS,
        100,
        '60000',
      ),
    ).toEqual({ amount: '0.01', total: '1000.00' });
    // 0 % empties the size.
    expect(shareOfFunds(draft(), BTC, FUNDS, 0, null)).toEqual({
      amount: '',
      total: '',
    });
  });

  it('tells the share of the free balance an order uses, for the slider', () => {
    // A buy: its total against 1,000 USDT free.
    expect(shareInUse(draft({ total: '250' }), FUNDS, null)).toBe(25);
    expect(shareInUse(draft({ total: '5000' }), FUNDS, null)).toBe(100);
    expect(shareInUse(draft({ total: '' }), FUNDS, null)).toBe(0);
    // A sale: its amount against 0.1 BTC free, or its total at the last price.
    expect(
      shareInUse(draft({ side: 'SELL', amount: '0.033' }), FUNDS, null),
    ).toBe(33);
    expect(
      shareInUse(
        draft({ side: 'SELL', type: 'MARKET', byTotal: true, total: '3000' }),
        FUNDS,
        '60000',
      ),
    ).toBe(50);
    expect(shareInUse(draft(), { quote: '0', base: '0' }, null)).toBe(0);
  });

  it('tells the most a buy gets and a sale brings at the order price', () => {
    expect(maxOrder(draft({ price: '60000' }), BTC, FUNDS, null)).toBe(
      '0.01666',
    );
    expect(maxOrder(draft({ side: 'SELL' }), BTC, FUNDS, null)).toBe('6000.00');
    // A market order is valued at the last price; none known, no maximum.
    expect(maxOrder(draft({ type: 'MARKET' }), BTC, FUNDS, '50000')).toBe(
      '0.02000',
    );
    expect(maxOrder(draft({ type: 'MARKET' }), BTC, FUNDS, null)).toBeNull();
  });

  it('keeps amount and total in step both ways', () => {
    expect(totalOf(draft(), '0.012', null)).toBe('720.00');
    expect(amountOf(draft(), '720', BTC, null)).toBe('0.01200');
    expect(totalOf(draft({ type: 'MARKET' }), '0.01', null)).toBe('');
    expect(totalOf(draft({ type: 'MARKET' }), '0.01', '61000')).toBe('610.00');
    expect(
      totalOf(draft({ type: 'STOP_MARKET', stop: '59000' }), '0.01', '61000'),
    ).toBe('590.00');
  });

  it('writes a picked trade price at the pair tick, as its row shows it', () => {
    expect(pickedPrice('81980.01000000', BTC.tickSize)).toBe('81980.01');
    expect(pickedPrice('81980.00500000', BTC.tickSize)).toBe('81980.01');
    expect(pickedPrice('81980', BTC.tickSize)).toBe('81980.00');
    expect(pickedPrice('0.00001234', '0.00000001')).toBe('0.00001234');
    expect(pickedPrice('81980.01000000', null)).toBe('81980.01000000');
  });
});
