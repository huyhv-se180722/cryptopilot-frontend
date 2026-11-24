import { describe, expect, it } from 'vitest';
import type { FuturesPosition } from '../../../types/futures';
import { isolatedLiquidationAfter } from './adjust-margin';
import type { Bracket } from './futures-math';

const BRACKETS: Bracket[] = [
  {
    bracketNo: 1,
    notionalFloor: '0',
    notionalCap: '1000000',
    maxLeverage: 125,
    maintenanceMarginRate: '0.004',
    maintenanceAmount: '0',
  },
];
// 0.5 BTC at 60,000 on 10x isolated: 3,000 USDT in its wallet.
const long = {
  symbol: 'BTCUSDT',
  positionSide: 'BOTH',
  positionAmt: '0.5',
  entryPrice: '60000',
  isolatedWallet: '3000',
  marginType: 'ISOLATED',
} as FuturesPosition;
const short = { ...long, positionAmt: '-0.5' } as FuturesPosition;

describe('the liquidation price after adjusting isolated margin (TR-F4, 4.9)', () => {
  it('moves away from the mark when margin is added, nearer when removed', () => {
    // LP = (W − side × Q × E + cum) / (Q × (MMR − side)), to the tick
    // towards the position: (4,000 − 30,000) / (0.5 × −0.996) = 52,208.83….
    const cases: [FuturesPosition, 'add' | 'remove', string, string][] = [
      [long, 'add', '1000', '52208.9'],
      [long, 'remove', '1000', '56224.9'],
      // (4,000 + 30,000) / (0.5 × 1.004) = 67,729.08…, down for a short.
      [short, 'add', '1000', '67729.0'],
      [short, 'remove', '1000', '63745.0'],
    ];
    for (const [position, mode, amount, expected] of cases)
      expect(
        isolatedLiquidationAfter(
          position,
          mode,
          amount,
          '2000',
          BRACKETS,
          '0.1',
        ),
        `${position.positionAmt} ${mode} ${amount}`,
      ).toBe(expected);
  });

  it('shows nothing until it can be worked out', () => {
    const after = ({
      position = long,
      mode = 'add' as 'add' | 'remove',
      amount = '1000',
      max = '2000' as string | null,
      brackets = BRACKETS as Bracket[] | null,
      tickSize = '0.1' as string | null,
    }) =>
      isolatedLiquidationAfter(position, mode, amount, max, brackets, tickSize);
    expect(after({})).toBe('52208.9');
    // Not an amount, more than allowed, brackets or tick not read, cross.
    for (const amount of ['', '0', '-5', 'abc'])
      expect(after({ amount })).toBeNull();
    expect(after({ amount: '2000.01' })).toBeNull();
    expect(after({ brackets: null })).toBeNull();
    expect(after({ tickSize: null })).toBeNull();
    expect(
      after({
        position: { ...long, marginType: 'CROSSED' } as FuturesPosition,
      }),
    ).toBeNull();
    // Without a known most, any amount is worked out: 1 USDT left of 3,000.
    expect(after({ mode: 'remove', amount: '2999', max: null })).toBe(
      '60239.0',
    );
  });
});
