import type { Copy } from '../../../i18n/locales/en';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';

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
