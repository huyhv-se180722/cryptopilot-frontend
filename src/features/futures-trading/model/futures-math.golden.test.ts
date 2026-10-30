import Big from 'big.js';
import { describe, expect, it } from 'vitest';
import bracketsFile from './golden/brackets.json?raw';
import cashFlow from './golden/cash-flow.json?raw';
import liquidation from './golden/liquidation-price.json?raw';
import margin from './golden/margin.json?raw';
import orderCostFile from './golden/order-cost.json?raw';
import positions from './golden/positions.json?raw';
import * as math from './futures-math';
import type { Bracket } from './futures-math';

/**
 * The shared golden cases of the paper Futures arithmetic (TR-45): the
 * backend's `FuturesGoldenTest` runs the same files (a copy of
 * `tools/golden/futures` in the backend repository), so both sides give the
 * same numbers. A case changes in both places or not at all.
 */
type Input = Record<string, unknown>;
interface Case {
  id: string;
  fn: string;
  input: Input;
  expect?: Record<string, unknown>;
  tolerance?: string;
  error?: boolean;
}

const bracketSets = JSON.parse(bracketsFile) as Record<string, Bracket[]>;
const files = { cashFlow, liquidation, margin, orderCostFile, positions };

const s = (input: Input, name: string) => input[name] as string;
const n = (input: Input, name: string) => input[name] as number;
const bracketsOf = (input: Input) => {
  const set = bracketSets[s(input, 'brackets')];
  if (!set) throw new Error('unknown bracket set ' + s(input, 'brackets'));
  return set;
};

/** The case's function, its results by the names the case expects. */
function run(c: Case): Record<string, unknown> {
  const i = c.input;
  switch (c.fn) {
    case 'bracket': {
      const found = math.bracketFor(bracketsOf(i), s(i, 'notional'));
      return {
        bracketNo: found?.bracketNo ?? null,
        maintenanceAmount: found?.maintenanceAmount ?? null,
      };
    }
    case 'maintenanceMargin':
      return {
        value: math.maintenanceMargin(bracketsOf(i), s(i, 'notional')),
      };
    case 'maxNotionalAtLeverage':
      return {
        value: math.maxNotionalAtLeverage(bracketsOf(i), n(i, 'leverage')),
      };
    case 'unrealizedPnl':
      return {
        value: math.unrealizedPnl(
          s(i, 'direction') as math.Direction,
          s(i, 'quantity'),
          s(i, 'entryPrice'),
          s(i, 'markPrice'),
        ),
      };
    case 'applyFill':
      return {
        ...math.applyFill(
          s(i, 'quantityBefore'),
          (i.entryPriceBefore as string | null) ?? null,
          s(i, 'side') as math.Side,
          s(i, 'quantity'),
          s(i, 'price'),
        ),
      };
    case 'orderCost':
      return {
        value: math.orderCost(
          s(i, 'side') as math.Side,
          s(i, 'quantity'),
          (i.limitPrice as string | null) ?? null,
          s(i, 'lastPrice'),
          s(i, 'markPrice'),
          n(i, 'leverage'),
        ),
      };
    case 'isolatedFillMargin':
      return {
        value: math.isolatedFillMargin(
          s(i, 'direction') as math.Direction,
          s(i, 'quantity'),
          s(i, 'fillPrice'),
          s(i, 'markPrice'),
          n(i, 'leverage'),
        ),
      };
    case 'openOrderInitialMargin':
      return {
        value: math.openOrderInitialMargin(
          s(i, 'positionQuantity'),
          i.orders as math.PendingOrderMargin[],
        ),
      };
    case 'accountMargin':
      return {
        ...math.accountMargin(
          s(i, 'crossWalletBalance'),
          s(i, 'crossUnrealizedPnl'),
          s(i, 'crossPositionInitialMargin'),
          s(i, 'openOrderInitialMargin'),
        ),
      };
    case 'maxOpenQuantity': {
      const brackets = bracketsOf(i);
      return {
        value: math.maxOpenQuantity(
          s(i, 'side') as math.Side,
          (i.limitPrice as string | null) ?? null,
          s(i, 'lastPrice'),
          s(i, 'markPrice'),
          n(i, 'leverage'),
          s(i, 'budget'),
          s(i, 'positionQuantity'),
          math.maxNotionalAtLeverage(brackets, n(i, 'leverage')),
          s(i, 'stepSize'),
        ),
      };
    }
    case 'maxRemovableMargin':
      return {
        value: math.maxRemovableMargin(
          s(i, 'isolatedWallet'),
          s(i, 'unrealizedPnl'),
          s(i, 'markNotional'),
          n(i, 'leverage'),
        ),
      };
    case 'marginRatio':
      return {
        value: math.marginRatio(
          s(i, 'maintenanceMargin'),
          s(i, 'marginBalance'),
        ),
      };
    case 'liquidationPrice':
      return {
        value: math.liquidationPrice(
          s(i, 'direction') as math.Direction,
          s(i, 'quantity'),
          s(i, 'entryPrice'),
          s(i, 'walletBalance'),
          s(i, 'otherMaintenanceMargin'),
          s(i, 'otherUnrealizedPnl'),
          bracketsOf(i),
          s(i, 'tickSize'),
        ),
      };
    case 'closeFlow':
      return {
        ...math.closeFlow(
          s(i, 'isolatedWallet'),
          s(i, 'closedQuantity'),
          s(i, 'positionQuantity'),
          s(i, 'realizedPnl'),
          s(i, 'fee'),
        ),
      };
    case 'fundingFlow':
      return {
        ...math.fundingFlow(s(i, 'isolatedWallet'), s(i, 'fundingFee')),
      };
    case 'fundingFee':
      return {
        value: math.fundingFee(
          s(i, 'direction') as math.Direction,
          s(i, 'quantity'),
          s(i, 'markPrice'),
          s(i, 'fundingRate'),
        ),
      };
    case 'liquidationFee':
      return {
        value: math.liquidationFee(
          s(i, 'notional'),
          s(i, 'feeRate'),
          s(i, 'remaining'),
        ),
      };
    default:
      throw new Error('no runner for ' + c.fn);
  }
}

const isDecimal = (value: unknown): value is string =>
  typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);

for (const [name, raw] of Object.entries(files)) {
  const cases = (JSON.parse(raw) as { cases: Case[] }).cases;
  describe('golden ' + name, () => {
    for (const c of cases) {
      it(c.id + ' ' + c.fn, () => {
        if (c.error) {
          expect(() => run(c)).toThrow();
          return;
        }
        const actual = run(c);
        for (const [key, expected] of Object.entries(c.expect ?? {})) {
          const got = actual[key];
          if (isDecimal(expected) && isDecimal(got)) {
            const difference = new Big(got).minus(expected).abs();
            expect(
              difference.lte(c.tolerance ?? '0'),
              `${key}: ${got} ≠ ${expected}`,
            ).toBe(true);
          } else if (expected !== null && typeof expected === 'number') {
            expect(Number(got), key).toBe(expected);
          } else {
            expect(got ?? null, key).toEqual(expected);
          }
        }
      });
    }
  });
}
