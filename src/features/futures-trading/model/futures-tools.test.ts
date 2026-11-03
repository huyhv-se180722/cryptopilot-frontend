import { describe, expect, it } from 'vitest';
import type { FuturesIncome, FuturesOrder } from '../../../types/futures';
import { checkInputs, requestOf, type Inputs } from './futures-calculator';
import { isAmendable } from './futures-form';
import { daysBefore, sumIncome } from './futures-pnl';

const inputs = (change: Partial<Inputs> = {}): Inputs => ({
  side: 'LONG',
  marginType: 'CROSSED',
  leverage: '10',
  entryPrice: '60000',
  exitPrice: '',
  quantity: '',
  roe: '',
  walletBalance: '',
  lots: [{ price: '', quantity: '' }],
  ...change,
});

describe('Futures calculator form (TR-44)', () => {
  it('asks each tab only for its own fields', () => {
    expect(checkInputs('pnl', inputs(), 125)).toEqual({
      exitPrice: 'required',
      quantity: 'required',
    });
    expect(checkInputs('target', inputs({ roe: '-25' }), 125)).toEqual({});
    expect(checkInputs('target', inputs({ roe: '0' }), 125)).toEqual({
      roe: 'invalid',
    });
    expect(checkInputs('maxOpen', inputs(), 125)).toEqual({
      walletBalance: 'required',
    });
  });

  it('keeps the leverage a whole number within the pair', () => {
    expect(
      checkInputs('target', inputs({ leverage: '126', roe: '5' }), 125),
    ).toEqual({ leverage: 'invalid' });
    expect(
      checkInputs('target', inputs({ leverage: '2.5', roe: '5' }), 125),
    ).toEqual({ leverage: 'invalid' });
    expect(
      checkInputs('target', inputs({ leverage: '0', roe: '5' }), 125),
    ).toEqual({ leverage: 'invalid' });
  });

  it('needs the wallet for a cross liquidation, not for an isolated one', () => {
    const liq = inputs({ quantity: '0.1' });
    expect(checkInputs('liquidation', liq, 125)).toEqual({
      walletBalance: 'required',
    });
    expect(
      checkInputs('liquidation', { ...liq, marginType: 'ISOLATED' }, 125),
    ).toEqual({});
  });

  it('averages only the parts filled in, each with a price and a quantity', () => {
    expect(checkInputs('openPrice', inputs(), 125)).toEqual({
      lots: 'required',
    });
    const half = inputs({ lots: [{ price: '100', quantity: '' }] });
    expect(checkInputs('openPrice', half, 125)).toEqual({ lots: 'invalid' });
    const lots = inputs({
      lots: [
        { price: '100', quantity: '1' },
        { price: '', quantity: '' },
        { price: '110', quantity: '3' },
      ],
    });
    expect(checkInputs('openPrice', lots, 125)).toEqual({});
    expect(requestOf('openPrice', 'BTCUSDT', lots)).toEqual({
      symbol: 'BTCUSDT',
      lots: [
        { price: '100', quantity: '1' },
        { price: '110', quantity: '3' },
      ],
    });
  });

  it('sends the fields of the tab under the backend names', () => {
    expect(
      requestOf(
        'pnl',
        'BTCUSDT',
        inputs({ exitPrice: '66000', quantity: '0.5', walletBalance: '9' }),
      ),
    ).toEqual({
      symbol: 'BTCUSDT',
      side: 'LONG',
      leverage: 10,
      entryPrice: '60000',
      exitPrice: '66000',
      quantity: '0.5',
    });
    expect(
      requestOf(
        'liquidation',
        'ETHUSDT',
        inputs({ side: 'SHORT', marginType: 'ISOLATED', quantity: '2' }),
      ),
    ).toEqual({
      symbol: 'ETHUSDT',
      side: 'SHORT',
      leverage: 10,
      entryPrice: '60000',
      quantity: '2',
      marginType: 'ISOLATED',
    });
  });
});

const order = (change: Partial<FuturesOrder>): FuturesOrder => ({
  orderId: 'o-1',
  clientOrderId: 'c-1',
  symbol: 'BTCUSDT',
  status: 'NEW',
  statusReason: null,
  type: 'LIMIT',
  side: 'BUY',
  positionSide: 'BOTH',
  timeInForce: 'GTC',
  price: '60000',
  avgPrice: '0',
  origQty: '0.1',
  executedQty: '0',
  cumQuote: '0',
  reduceOnly: false,
  closePosition: false,
  goodTillDate: null,
  time: '2026-11-04T00:00:00Z',
  updateTime: '2026-11-04T00:00:00Z',
  ...change,
});

describe('which orders can be edited', () => {
  it('is a waiting LIMIT order only', () => {
    expect(isAmendable(order({}))).toBe(true);
    expect(isAmendable(order({ status: 'PARTIALLY_FILLED' }))).toBe(true);
    expect(isAmendable(order({ type: 'MARKET' }))).toBe(false);
    expect(isAmendable(order({ status: 'FILLED' }))).toBe(false);
    expect(isAmendable(order({ status: 'CANCELED' }))).toBe(false);
  });
});

const income = (incomeType: string, value: string): FuturesIncome => ({
  symbol: 'BTCUSDT',
  incomeType,
  income: value,
  asset: 'USDT',
  info: null,
  time: '2026-11-04T00:00:00Z',
  tranId: incomeType + value,
});

describe('Futures PnL of a period', () => {
  it('sums realized PnL, funding and fees, leaving transfers out', () => {
    expect(
      sumIncome([
        income('REALIZED_PNL', '120.5'),
        income('REALIZED_PNL', '-20.5'),
        income('FUNDING_FEE', '-1.25'),
        income('COMMISSION', '-3'),
        income('INSURANCE_CLEAR', '-2'),
        income('TRANSFER', '5000'),
      ]),
    ).toEqual({ realized: '100', funding: '-1.25', fees: '-5', net: '93.75' });
    expect(sumIncome([])).toEqual({
      realized: '0',
      funding: '0',
      fees: '0',
      net: '0',
    });
  });

  it('starts the period the given days before now', () => {
    const now = Date.parse('2026-11-04T12:00:00Z');
    expect(daysBefore(now, 7)).toBe('2026-10-28T12:00:00.000Z');
  });
});
