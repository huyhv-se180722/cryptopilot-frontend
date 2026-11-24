import type { FuturesPosition } from '../../../types/futures';
import {
  add,
  compare,
  isPlainDecimal,
  isPositive,
  subtract,
} from '../../../utils/decimal-math';
import { liquidationPrice, type Bracket } from './futures-math';

/**
 * The liquidation price of an isolated one-way position once `amount` is
 * added to or removed from its wallet (4.5, 4.9): the position's own wallet
 * is its balance, nothing else counts. Null while the amount is not a
 * positive decimal within the most allowed, or the brackets are not read.
 */
export function isolatedLiquidationAfter(
  position: FuturesPosition,
  mode: 'add' | 'remove',
  amount: string,
  max: string | null,
  brackets: readonly Bracket[] | null,
  tickSize: string | null,
): string | null {
  if (!brackets || !tickSize || position.marginType !== 'ISOLATED') return null;
  if (!(isPlainDecimal(amount) && isPositive(amount))) return null;
  if (max !== null && compare(amount, max) > 0) return null;
  const quantity = position.positionAmt.replace('-', '');
  if (!isPositive(quantity)) return null;
  const wallet =
    mode === 'add'
      ? add(position.isolatedWallet, amount)
      : subtract(position.isolatedWallet, amount);
  const price = liquidationPrice(
    position.positionAmt.startsWith('-') ? 'SHORT' : 'LONG',
    quantity,
    position.entryPrice,
    wallet,
    '0',
    '0',
    brackets,
    tickSize,
  );
  return isPositive(price) ? price : null;
}
