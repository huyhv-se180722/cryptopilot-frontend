import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { buttonClassName } from '../../components/ui/button-styles';
import { Card } from '../../components/ui/Card';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { CheckoutDialog } from '../../features/subscription/components/CheckoutDialog';
import { PackageCard } from '../../features/subscription/components/PackageCard';
import { billingErrorText } from '../../features/subscription/components/billing-errors';
import {
  useCurrentSubscription,
  useGateways,
  usePackages,
  useQuote,
} from '../../features/subscription/hooks/use-billing';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type { OrderQuote, SubscriptionPackage } from '../../types/domain';
import { formatInstantLocal } from '../../utils/instant-format';

type Period = 'monthly' | 'yearly';
const YEAR_DAYS = 365;

/**
 * SCR-30 Subscription plans (SRS 3.10, UC-37/38, T-071): the plan held, the
 * packages of one billing period with their rights, and buying one through
 * the backend's quote and a payment gateway. A lower tier than the plan
 * held cannot be bought (the backend refuses it too).
 */
export function SubscriptionPage() {
  const copy = useCopy();
  const b = copy.billing;
  const { show } = useToast();
  const packages = usePackages();
  const current = useCurrentSubscription();
  const gateways = useGateways();
  const quote = useQuote();
  const [period, setPeriod] = useState<Period>('monthly');
  const [buying, setBuying] = useState<{
    pkg: SubscriptionPackage;
    quote: OrderQuote;
  } | null>(null);

  const held = current.data?.tier ?? 'FREE';

  async function buy(pkg: SubscriptionPackage) {
    const result = await quote.run(pkg.code);
    if (result.status === 'success') setBuying({ pkg, quote: result.data });
    else if (result.status === 'error')
      show({ tone: 'error', message: billingErrorText(copy, result.error) });
  }

  const shown = (packages.data ?? []).filter(
    (p) =>
      p.tier === 'FREE' ||
      (period === 'yearly'
        ? p.durationDays === YEAR_DAYS
        : p.durationDays !== YEAR_DAYS),
  );

  const failed = packages.isError
    ? packages.error
    : current.isError
      ? current.error
      : null;
  const body =
    packages.isPending || current.isPending ? (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((k) => (
          <Skeleton key={k} className="h-96 w-full" />
        ))}
      </div>
    ) : failed ? (
      <ErrorState
        message={errorText(copy, failed)}
        onRetry={() => {
          void packages.refetch();
          void current.refetch();
        }}
      />
    ) : (
      <div className="grid gap-4 md:grid-cols-3">
        {shown.map((pkg) => (
          <PackageCard
            key={pkg.code}
            pkg={pkg}
            held={held}
            busy={quote.pending || gateways.isPending}
            onBuy={(p) => void buy(p)}
          />
        ))}
      </div>
    );

  const sub = current.data;
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={b.title}
        description={b.subtitle}
        actions={
          <Link
            to="/subscription/payments"
            className={buttonClassName('secondary', 'md')}
          >
            {b.viewHistory}
          </Link>
        }
      />
      {sub && (
        <Card
          padding="md"
          className="mb-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              {b.currentTitle}
            </p>
            <p className="text-sm font-medium text-fg">
              {sub.tier === 'FREE' || !sub.endAt
                ? b.currentFree
                : formatCopy(b.currentPaid, {
                    plan: sub.packageName ?? sub.tier,
                    end: formatInstantLocal(sub.endAt),
                  })}
            </p>
          </div>
          <SegmentedControl
            label={b.periodLabel}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'monthly', label: b.monthly },
              { value: 'yearly', label: b.yearly },
            ]}
          />
        </Card>
      )}
      {body}
      {buying && (
        <CheckoutDialog
          pkg={buying.pkg}
          quote={buying.quote}
          gateways={gateways.data ?? []}
          onClose={() => setBuying(null)}
        />
      )}
    </div>
  );
}
