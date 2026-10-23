import type { Copy } from '../../../i18n/locales/en';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import { groupThousands } from '../../../utils/decimal-format';

/**
 * A demo trading refusal in words: the backend's codes first (insufficient
 * balance, order no longer open), then its MSG catalog message.
 */
export function paperErrorText(copy: Copy, error: unknown): string {
  switch (problemOf(error)?.code) {
    case 'PAPER_INSUFFICIENT_BALANCE':
      return copy.paper.insufficientServer;
    case 'PAPER_ORDER_NOT_OPEN':
      return copy.paper.orderNotOpen;
    default:
      return errorText(copy, error);
  }
}

/** The Spot symbol filters the backend refuses an order by (TR-02). */
const FILTER_CODES = [
  'PAPER_PRICE_FILTER',
  'PAPER_LOT_SIZE',
  'PAPER_MARKET_LOT_SIZE',
  'PAPER_NOTIONAL',
  'PAPER_PERCENT_PRICE',
  'PAPER_TRAILING_DELTA',
] as const;
type FilterCode = (typeof FILTER_CODES)[number];
const isFilterCode = (code: string): code is FilterCode =>
  (FILTER_CODES as readonly string[]).includes(code);

/** A Spot order refusal the form can explain: its field, when it has one. */
export interface SpotRefusal {
  /** The request field the backend names, e.g. `price` or `oco.quantity`. */
  field: string | null;
  text: string;
}

/**
 * A Spot filter or open-order limit refusal in words, or undefined for any
 * other error. A filter refusal carries `[field, value, limit, bound]`
 * (bound MIN, MAX or STEP), an open-order limit `[field, count, limit, MAX]`
 * (backend `develop` 612b201). `quote` names the asset of an order value.
 */
export function spotRefusal(
  copy: Copy,
  error: unknown,
  quote: string,
): SpotRefusal | undefined {
  const problem = problemOf(error);
  if (!problem) return undefined;
  const p = copy.paper;
  const [field, , limit, bound] = problem.messageArgs;
  if (!field || !limit) return undefined;
  if (
    problem.code === 'PAPER_MAX_NUM_ORDERS' ||
    problem.code === 'PAPER_MAX_NUM_ALGO_ORDERS'
  )
    return {
      field: null,
      text: formatCopy(
        problem.code === 'PAPER_MAX_NUM_ORDERS'
          ? p.tooManyOrders
          : p.tooManyStops,
        { limit },
      ),
    };
  if (!isFilterCode(problem.code)) return undefined;
  if (bound !== 'MIN' && bound !== 'MAX' && bound !== 'STEP') return undefined;
  const shown = groupThousands(limit);
  const min = bound === 'MIN';
  let text: string;
  switch (problem.code) {
    case 'PAPER_NOTIONAL':
      text = formatCopy(min ? p.errMinNotional : p.errMaxNotional, {
        min: shown,
        max: shown,
        asset: quote,
      });
      break;
    case 'PAPER_PERCENT_PRICE':
      text = formatCopy(min ? p.errPercentBelow : p.errPercentAbove, {
        limit: shown,
      });
      break;
    case 'PAPER_TRAILING_DELTA':
      // Basis points on the wire, percent on the form: 100 = 1 %.
      text = formatCopy(min ? p.errTrailingMin : p.errTrailingMax, {
        limit: String(Number(limit) / 100),
      });
      break;
    default:
      text = formatCopy(
        bound === 'STEP' ? p.errStep : min ? p.errAtLeast : p.errAtMost,
        { limit: shown },
      );
  }
  return { field, text };
}
