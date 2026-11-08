import type { Copy } from '../../../i18n/locales/en';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';

/**
 * The billing refusals come back as MSG43 with a code of their own; the
 * code says what happened, so it is shown instead of the generic message.
 */
export function billingErrorText(copy: Copy, error: unknown): string {
  const b = copy.billing;
  switch (problemOf(error)?.code) {
    case 'SUBSCRIPTION_DOWNGRADE_REFUSED':
      return b.errorDowngrade;
    case 'PACKAGE_NOT_ON_SALE':
      return b.errorNotOnSale;
    case 'PAYMENT_GATEWAY_DISABLED':
      return b.errorGatewayOff;
    case 'PAYMENT_GATEWAY_UNAVAILABLE':
      return b.errorGatewayDown;
    default:
      return errorText(copy, error);
  }
}
