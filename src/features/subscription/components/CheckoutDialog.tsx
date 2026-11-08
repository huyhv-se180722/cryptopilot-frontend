import { useState } from 'react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  OrderQuote,
  PaymentGateway,
  PaymentGatewayCode,
  SubscriptionPackage,
} from '../../../types/domain';
import { formatInstantLocal } from '../../../utils/instant-format';
import { billingErrorText } from './billing-errors';
import { goToCheckout, vnd } from './billing-format';
import { useCreateOrder } from '../hooks/use-billing';

/**
 * SCR-30 confirmation: the quote of the backend (type, amount, value carried
 * over, bonus days), then the gateway; paying creates the order and leaves
 * for the gateway page.
 */
export function CheckoutDialog({
  pkg,
  quote,
  gateways,
  onClose,
}: {
  pkg: SubscriptionPackage;
  quote: OrderQuote;
  gateways: readonly PaymentGateway[];
  onClose: () => void;
}) {
  const copy = useCopy();
  const b = copy.billing;
  const enabled = gateways.filter((g) => g.enabled);
  const [gateway, setGateway] = useState<PaymentGatewayCode | null>(
    enabled[0]?.code ?? null,
  );
  const create = useCreateOrder();
  const [leaving, setLeaving] = useState(false);
  const busy = create.pending || leaving;

  async function pay() {
    if (gateway === null) return;
    const result = await create.run(quote.packageCode, gateway);
    if (result.status === 'success') {
      setLeaving(true);
      goToCheckout(result.data.checkout);
    }
  }

  // Only an upgrade turns the unused value into days; a renewal keeps them.
  const carried =
    quote.orderType === 'UPGRADE' && Number(quote.carriedValueVnd) > 0;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={formatCopy(b.quoteTitle, { plan: pkg.name })}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {b.cancel}
          </Button>
          <Button
            disabled={busy || gateway === null}
            onClick={() => void pay()}
          >
            {leaving
              ? b.redirecting
              : formatCopy(b.pay, { amount: vnd(quote.amount) })}
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">{b.orderType}</dt>
        <dd className="text-right text-fg">{b[`type${quote.orderType}`]}</dd>
        <dt className="text-muted">{b.amount}</dt>
        <dd className="text-right font-mono font-semibold text-fg">
          {vnd(quote.amount)}
        </dd>
        <dt className="text-muted">{b.period}</dt>
        <dd className="text-right font-mono text-fg">
          {formatCopy(b.periodValue, {
            start: formatInstantLocal(quote.startAt),
            end: formatInstantLocal(quote.endAt),
          })}
        </dd>
        {carried && (
          <>
            <dt className="text-muted">{b.carriedValue}</dt>
            <dd className="text-right font-mono text-fg">
              {vnd(quote.carriedValueVnd)}
            </dd>
          </>
        )}
        {quote.bonusDays > 0 && (
          <>
            <dt className="text-muted">{b.bonusDays}</dt>
            <dd className="text-right font-mono text-positive">
              {formatCopy(b.bonusValue, { days: String(quote.bonusDays) })}
            </dd>
          </>
        )}
      </dl>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-fg">
          {b.payWith}
        </legend>
        {enabled.length === 0 ? (
          <Alert title={b.noGateway} tone="warning" />
        ) : (
          <div className="grid gap-2">
            {enabled.map((g) => (
              <label
                key={g.code}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm text-fg has-[:checked]:border-primary-line has-[:checked]:bg-primary-soft"
              >
                <input
                  type="radio"
                  name="gateway"
                  value={g.code}
                  checked={gateway === g.code}
                  disabled={busy}
                  onChange={() => setGateway(g.code)}
                />
                {b[`gateway${g.code}`]}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <p className="mt-4 text-xs text-muted">{b.quoteNote}</p>
      {create.state.status === 'error' && (
        <Alert
          title={billingErrorText(copy, create.state.error)}
          tone="danger"
          className="mt-3"
        />
      )}
    </Dialog>
  );
}
