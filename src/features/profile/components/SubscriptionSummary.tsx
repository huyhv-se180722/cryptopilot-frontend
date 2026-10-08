import { Link } from 'react-router-dom';
import { Alert } from '../../../components/feedback/States';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useAuth } from '../../../hooks/use-auth';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { SectionTitle } from '../../../components/ui/SectionTitle';

/**
 * SCR-07 Subscription tab. Shows the plan the session reports (display
 * only, D-58); end date, scheduled subscriptions and usage wait for the
 * subscription API, so nothing is invented here.
 */
export function SubscriptionSummary() {
  const copy = useCopy();
  const p = copy.profile;
  const { session } = useAuth();
  const entitlements = session?.entitlements ?? 'unknown';
  return (
    <Card padding="lg" className="max-w-xl">
      <SectionTitle>{p.subscriptionTitle}</SectionTitle>
      <div className="mb-4">
        {entitlements === 'unknown' ? (
          <Badge>{p.subscriptionUnknown}</Badge>
        ) : (
          <Badge tone="info">
            {formatCopy(p.subscriptionPlan, { plan: entitlements.tier })}
          </Badge>
        )}
      </div>
      <Alert title={copy.integration.pendingTitle} className="mb-5">
        {p.subscriptionPending}
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Link to="/subscription" className={buttonClassName('primary', 'md')}>
          {p.viewPlans}
        </Link>
        <Link
          to="/subscription/payments"
          className={buttonClassName('secondary', 'md')}
        >
          {p.viewPayments}
        </Link>
      </div>
    </Card>
  );
}
