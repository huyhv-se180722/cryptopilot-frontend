import type { Copy } from '../../../i18n/locales/en';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import { groupThousands } from '../../../utils/decimal-format';

/**
 * A paper Futures refusal in words. The backend's code names the rule and
 * carries the exchange's code (`binanceCode`); the message arguments give
 * the figures (D-127).
 */
export function futuresErrorText(copy: Copy, error: unknown): string {
  const problem = problemOf(error);
  const f = copy.futures;
  if (!problem) return errorText(copy, error);
  const [first, second, third] = problem.messageArgs;
  const binance = problem.extensions?.binanceCode;
  switch (problem.code) {
    case 'PAPER_INSUFFICIENT_MARGIN':
      return formatCopy(f.errMargin, {
        cost: groupThousands(first ?? '0'),
        budget: groupThousands(second ?? '0'),
      });
    case 'PAPER_MAX_POSITION_AT_LEVERAGE':
      return f.errMaxPosition;
    case 'PAPER_REDUCE_ONLY_REJECTED':
      return f.errReduceOnly;
    case 'PAPER_USER_IN_LIQUIDATION':
      return f.errLiquidating;
    case 'PAPER_ORDER_WOULD_TAKE':
      return f.errPostOnly;
    case 'PAPER_ORDER_WOULD_TRIGGER':
      return f.errWouldTrigger;
    case 'PAPER_MARGIN_TYPE':
      return binance === -4046 ? f.errSameMarginType : f.errMarginTypeBusy;
    case 'PAPER_POSITION_MODE':
      return binance === -4059 ? f.errSameMode : f.errModeBusy;
    case 'PAPER_LEVERAGE_MARGIN':
      return f.errLeverageMargin;
    case 'PAPER_POSITION_MARGIN':
      return f.errPositionMargin;
    case 'PAPER_ORDER_NOT_OPEN':
      return copy.paper.orderNotOpen;
    case 'PAPER_ORDER_UNCHANGED':
      return f.errUnchanged;
    case 'PAPER_PRICE_FILTER':
    case 'PAPER_LOT_SIZE':
    case 'PAPER_MARKET_LOT_SIZE':
    case 'PAPER_NOTIONAL':
    case 'PAPER_PERCENT_PRICE': {
      const limit = third ?? second;
      return limit
        ? formatCopy(f.errFilter, { limit: groupThousands(limit) })
        : errorText(copy, error);
    }
    case 'MARKET_PRICE_UNAVAILABLE':
      return f.errNoPrice;
    default:
      return errorText(copy, error);
  }
}
