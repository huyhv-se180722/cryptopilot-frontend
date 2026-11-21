import { classNames } from '../../../utils/class-names';
import {
  compare,
  divide,
  min,
  multiply,
  subtract,
} from '../../../utils/decimal-math';

/** The larger of two decimals. */
const max = (a: string, b: string) => (compare(a, b) >= 0 ? a : b);
/** The distance between two decimals. */
const span = (a: string, b: string) => subtract(max(a, b), min(a, b));

/**
 * Where `value` sits between `low` and `high`, as a CSS percent. Decimal
 * strings in (prices stay exact, ADR-019); the result is only a position
 * on screen, never shown as a figure.
 */
function position(value: string, low: string, high: string): string {
  return divide(
    multiply(subtract(value, low), '100'),
    subtract(high, low),
    2,
    'half-up',
  );
}

/**
 * A plan's prices on one line (T-141): the risk from the stop loss to the
 * entry in red, the reward from the entry to the take profit in green, a
 * tick at the entry and a taller one at the current price when known. Long
 * and Short read the same way, the stop loss on one end and the take profit
 * on the other. The caller names the whole line for assistive technology
 * (the figures are its words, in its language); nothing renders when the
 * prices do not span a range.
 */
export function PriceLadder({
  stopLoss,
  entry,
  takeProfit,
  current = null,
  label,
  className,
}: {
  stopLoss: string;
  entry: string;
  takeProfit: string;
  current?: string | null;
  label: string;
  className?: string;
}) {
  let low = min(stopLoss, takeProfit);
  let high = max(stopLoss, takeProfit);
  if (current !== null) {
    low = min(low, current);
    high = max(high, current);
  }
  if (compare(low, high) === 0) return null;
  const at = (value: string) => position(value, low, high);
  const stop = at(stopLoss);
  const open = at(entry);
  const take = at(takeProfit);
  return (
    <span
      role="img"
      aria-label={label}
      className={classNames('relative block h-5 min-w-24', className)}
    >
      <span
        data-part="risk"
        className="absolute top-2 h-1 rounded-sm bg-negative"
        style={{
          left: `${min(stop, open)}%`,
          width: `${span(stop, open)}%`,
        }}
      />
      <span
        data-part="reward"
        className="absolute top-2 h-1 rounded-sm bg-positive"
        style={{
          left: `${min(open, take)}%`,
          width: `${span(open, take)}%`,
        }}
      />
      <span
        data-part="entry"
        className="absolute top-1 h-3 w-0.5 -translate-x-1/2 bg-muted"
        style={{ left: `${open}%` }}
      />
      {current !== null && (
        <span
          data-part="current"
          className="absolute top-0 h-5 w-0.5 -translate-x-1/2 bg-fg"
          style={{ left: `${at(current)}%` }}
        />
      )}
    </span>
  );
}
