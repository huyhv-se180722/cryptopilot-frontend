import type { Tone } from '../../../components/ui/Badge';
import type {
  CheckoutForm,
  OrderStatus,
  PlanTier,
  SubscriptionPackage,
} from '../../../types/domain';
import { groupThousands, toFixedDecimal } from '../../../utils/decimal-format';

/** VND has no minor unit on screen: whole dong, grouped. */
export const vnd = (value: string) =>
  groupThousands(toFixedDecimal(value, 0)) + ' ₫';

export const statusTone: Record<OrderStatus, Tone> = {
  PENDING: 'warning',
  PAID: 'success',
  FAILED: 'danger',
  EXPIRED: 'neutral',
};

/**
 * Sends the browser to the gateway's payment page: a GET link is opened, a
 * POST checkout (SePay) is a hidden form submitted at once. The signed
 * fields go as they came; nothing here may change them.
 */
export function goToCheckout(checkout: CheckoutForm, doc: Document = document) {
  if (checkout.method === 'GET') {
    doc.defaultView?.location.assign(checkout.url);
    return;
  }
  const form = doc.createElement('form');
  form.method = 'POST';
  form.action = checkout.url;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = doc.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
}

const RANK: Record<PlanTier, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

/** What the card's button may do for a Trader holding `held`. */
export type PackageAction =
  'current' | 'choose' | 'renew' | 'upgrade' | 'lower' | 'none';

export function packageAction(
  pkg: SubscriptionPackage,
  held: PlanTier,
): PackageAction {
  if (pkg.tier === 'FREE') return held === 'FREE' ? 'current' : 'none';
  if (!pkg.purchasable) return 'none';
  if (RANK[pkg.tier] < RANK[held]) return 'lower';
  if (pkg.tier === held) return 'renew';
  return held === 'FREE' ? 'choose' : 'upgrade';
}
