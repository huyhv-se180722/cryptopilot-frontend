import { Link } from 'react-router-dom';
import { ErrorState } from '../../../components/feedback/States';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { SectionTitle } from '../../../components/ui/SectionTitle';
import { formatInstantLocal } from '../../../utils/instant-format';
import { useCurrentSubscription } from '../../subscription/hooks/use-billing';

/**
 * SCR-07 Subscription tab: the plan held as `GET /billing/subscription`
 * reports it (tier, package, end, bonus days carried over), with the way
 * to the plans (SCR-30) and the payment history (SCR-32).
 */
export function SubscriptionSummary() {
  const copy = useCopy();
  const p = copy.profile;
  const current = useCurrentSubscription();
  const sub = current.data;
  return (
    <Card padding="lg" className="max-w-xl">
      <SectionTitle>{p.subscriptionTitle}</SectionTitle>
      {current.isPending ? (
        <Skeleton className="mb-5 h-12 w-full" />
      ) : current.isError || !sub ? (
        <div className="mb-5">
          <ErrorState
            message={errorText(copy, current.error)}
            onRetry={() => void current.refetch()}
          />
        </div>
      ) : (
        <div className="mb-5 grid gap-2 text-sm">
          <div>
            <Badge tone={sub.tier === 'FREE' ? 'neutral' : 'info'}>
              {formatCopy(p.subscriptionPlan, {
                plan: sub.packageName ?? sub.tier,
              })}
            </Badge>
          </div>
          <p className="text-fg-2">
            {sub.endAt
              ? formatCopy(p.subscriptionEnds, {
                  date: formatInstantLocal(sub.endAt),
                })
              : p.subscriptionFree}
          </p>
          {sub.bonusDays !== null && sub.bonusDays > 0 && (
            <p className="text-muted">
              {formatCopy(p.subscriptionBonus, { days: String(sub.bonusDays) })}
            </p>
          )}
        </div>
      )}
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
