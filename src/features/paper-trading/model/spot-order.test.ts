import { describe, expect, it } from 'vitest';
import type { MarketPair } from '../../../types/domain';
import {
  amountOf,
  checkSpotOrder,
  shareOfFunds,
  totalOf,
  type SpotOrderDraft,
} from './spot-order';

const BTC: MarketPair = {
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
  side: 'BUY',
  type: 'LIMIT',
  timeInForce: 'GTC',
  price: '60000',
  amount: '0.01',
  total: '',
  byTotal: false,
  ...over,
});

describe('Spot order check (TR-F3)', () => {
  it('builds a LIMIT buy on the tick and step with its notional', () => {
    const check = checkSpotOrder(
      draft({ price: '60000.019', amount: '0.0100099' }),
      BTC,
      FUNDS,
      null,
    );
    expect(check.errors).toEqual({});
    expect(check.order).toEqual({
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
    expect(check.order?.price).toBe('60000.02');
  });

  it('refuses missing, invalid, too small, below-step and unaffordable orders', () => {
    expect(
      checkSpotOrder(draft({ price: '' }), BTC, FUNDS, null).errors,
    ).toEqual({
      price: 'required',
    });
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

  it('places a MARKET buy by total, checked against the free quote', () => {
    const market = draft({
      type: 'MARKET',
      byTotal: true,
      total: '250.123456789',
    });
    const check = checkSpotOrder(market, BTC, FUNDS, '60000');
    expect(check.order).toEqual({
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: '250.12345678',
    });
    expect(
      checkSpotOrder({ ...market, total: '1001' }, BTC, FUNDS, '60000').errors,
    ).toEqual({ total: 'insufficient' });
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
  });

  it('keeps amount and total in step both ways', () => {
    expect(totalOf(draft(), '0.012', null)).toBe('720.00');
    expect(amountOf(draft(), '720', BTC, null)).toBe('0.01200');
    expect(totalOf(draft({ type: 'MARKET' }), '0.01', null)).toBe('');
    expect(totalOf(draft({ type: 'MARKET' }), '0.01', '61000')).toBe('610.00');
  });
});
