import { describe, expect, it } from 'vitest';
import type { MarketPair } from '../../../types/domain';
import type { FuturesAlgoOrder, FuturesPosition } from '../../../types/futures';
import { exitsOf } from './position-exits';
import {
  EMPTY_DRAFT,
  inUnit,
  quantityOf,
  type FuturesDraft,
} from './futures-form';

const BTC: MarketPair = {
  pairId: 'p-btc',
  symbol: 'BTCUSDT',
  market: 'futures',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',
  baseAssetName: 'Bitcoin',
  logoUrl: null,
  tickSize: '0.1',
  stepSize: '0.001',
  minNotional: '5',
  displayOrder: 1,
};
const PRICES = { last: '60000', mark: '59990' };
const draft = (over: Partial<FuturesDraft>): FuturesDraft => ({
  ...EMPTY_DRAFT,
  price: '50000',
  ...over,
});

describe('Futures size by base, order value or margin (TR-F4)', () => {
  it('turns each unit into a quantity on the step, a margin through the leverage', () => {
    const cases: [Partial<FuturesDraft>, number | undefined, string | null][] =
      [
        [{ sizeUnit: 'BASE', size: '0.25' }, 10, '0.25'],
        // 1,000 USDT of order value at the limit of 50,000: 0.02 BTC.
        [{ sizeUnit: 'QUOTE', size: '1000' }, 10, '0.020'],
        // 100 USDT of margin at 10x: 1,000 of order value, the same 0.02 BTC.
        [{ sizeUnit: 'MARGIN', size: '100' }, 10, '0.020'],
        [{ sizeUnit: 'MARGIN', size: '100' }, 20, '0.040'],
        // A market order values at the last price: 100 × 5 / 60,000, floored.
        [{ sizeUnit: 'MARGIN', size: '100', type: 'MARKET' }, 5, '0.008'],
        // Without the leverage a margin cannot be turned into a quantity.
        [{ sizeUnit: 'MARGIN', size: '100' }, undefined, null],
        // Less than one step is no quantity.
        [{ sizeUnit: 'MARGIN', size: '0.001' }, 2, null],
      ];
    for (const [over, leverage, quantity] of cases)
      expect(
        quantityOf(draft(over), BTC, PRICES, leverage),
        JSON.stringify({ over, leverage }),
      ).toBe(quantity);
  });

  it('shows a quantity back in the unit of the form', () => {
    expect(inUnit('0.02', draft({ sizeUnit: 'BASE' }), PRICES, 10)).toBe(
      '0.02',
    );
    expect(
      Number(inUnit('0.02', draft({ sizeUnit: 'QUOTE' }), PRICES, 10)),
    ).toBe(1000);
    expect(
      Number(inUnit('0.02', draft({ sizeUnit: 'MARGIN' }), PRICES, 10)),
    ).toBe(100);
    expect(
      inUnit('0.02', draft({ sizeUnit: 'MARGIN' }), PRICES, undefined),
    ).toBeNull();
  });
});

describe('the TP/SL column of a position (TR-F4)', () => {
  const algo = (over: Partial<FuturesAlgoOrder>): FuturesAlgoOrder =>
    ({
      algoId: 'a',
      clientAlgoId: 'c',
      orderType: 'TAKE_PROFIT_MARKET',
      symbol: 'BTCUSDT',
      side: 'SELL',
      positionSide: 'BOTH',
      timeInForce: null,
      quantity: null,
      algoStatus: 'NEW',
      statusReason: null,
      actualOrderId: null,
      triggerPrice: '65000',
      price: null,
      workingType: 'CONTRACT_PRICE',
      closePosition: true,
      priceProtect: false,
      reduceOnly: false,
      createTime: '2026-11-23T00:00:00Z',
      updateTime: '2026-11-23T00:00:00Z',
      triggerTime: null,
      activatePrice: null,
      priceRate: null,
      ...over,
    }) as FuturesAlgoOrder;
  const long = {
    symbol: 'BTCUSDT',
    positionSide: 'BOTH',
    positionAmt: '0.5',
  } as FuturesPosition;
  const short = { ...long, positionAmt: '-0.5' } as FuturesPosition;

  it('takes the closing conditional orders of the other side, one of each kind', () => {
    const orders = [
      algo({ algoId: 'tp' }),
      algo({ algoId: 'sl', orderType: 'STOP_MARKET', triggerPrice: '55000' }),
      // Not this position's: another symbol, the same side, done, or opening.
      algo({ algoId: 'eth', symbol: 'ETHUSDT' }),
      algo({ algoId: 'buy', side: 'BUY' }),
      algo({
        algoId: 'gone',
        algoStatus: 'CANCELED',
        orderType: 'STOP_MARKET',
      }),
      algo({ algoId: 'open', closePosition: false, orderType: 'STOP_MARKET' }),
    ];
    const exits = exitsOf(long, orders);
    expect(exits.takeProfit?.algoId).toBe('tp');
    expect(exits.stopLoss?.algoId).toBe('sl');
    expect(exitsOf(short, orders).takeProfit?.algoId).toBe('buy');
    expect(exitsOf(short, orders).stopLoss).toBeUndefined();
    // A reduce-only stop guards it as a closePosition one does.
    expect(
      exitsOf(long, [
        algo({ orderType: 'STOP', closePosition: false, reduceOnly: true }),
      ]).stopLoss,
    ).toBeTruthy();
    expect(
      exitsOf({ ...long, positionSide: 'LONG' } as FuturesPosition, orders),
    ).toEqual({});
  });
});
