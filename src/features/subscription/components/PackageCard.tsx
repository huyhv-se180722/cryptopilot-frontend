import { Check, Minus } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { PlanTier, SubscriptionPackage } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { packageAction, vnd } from './billing-format';

export function PackageCard({
  pkg,
  held,
  busy,
  onBuy,
}: {
  pkg: SubscriptionPackage;
  held: PlanTier;
  busy: boolean;
  onBuy: (pkg: SubscriptionPackage) => void;
}) {
  const copy = useCopy();
  const b = copy.billing;
  const action = packageAction(pkg, held);
  const limit = (value: number | null) =>
    value === null ? b.unlimited : String(value);
  const features: readonly [string, boolean][] = [
    [b.featureFuturesAnalysis, pkg.futuresAnalysis],
    [b.featureScoreComponents, pkg.scoreComponents],
    [b.featureIndicatorAlert, pkg.indicatorAlert],
    [b.featureExternalAlertChannels, pkg.externalAlertChannels],
    [b.featureAdvancedPerformance, pkg.advancedPerformance],
    // No row for newsAiInsight: the news summaries are open to every plan.
    [b.featureAiPerformanceContext, pkg.aiPerformanceContext],
    [b.featureVideoPost, pkg.videoPost],
  ];
  const label =
    action === 'renew' ? b.renew : action === 'upgrade' ? b.upgrade : b.choose;
  const highlighted = pkg.tier === held;

  return (
    <Card
      padding="lg"
      className={classNames(
        'flex flex-col gap-4',
        highlighted && 'border-primary-line',
      )}
      aria-label={pkg.name}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-fg">{pkg.name}</h3>
        {highlighted && <Badge tone="info">{b.currentBadge}</Badge>}
      </div>
      <p className="font-mono text-2xl font-semibold text-fg">
        {pkg.tier === 'FREE' ? b.freePrice : vnd(pkg.price)}
        {pkg.durationDays !== null && (
          <span className="ml-1 font-sans text-sm font-normal text-muted">
            {formatCopy(b.perDays, { days: String(pkg.durationDays) })}
          </span>
        )}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">{b.limitPlans}</dt>
        <dd className="text-right font-mono text-fg">
          {limit(pkg.activePlanMax)}
        </dd>
        <dt className="text-muted">{b.limitWatchlist}</dt>
        <dd className="text-right font-mono text-fg">
          {limit(pkg.watchlistMax)}
        </dd>
        <dt className="text-muted">{b.limitAlerts}</dt>
        <dd className="text-right font-mono text-fg">
          {limit(pkg.activeAlertMax)}
        </dd>
        <dt className="text-muted">{b.aiQuota}</dt>
        <dd className="text-right font-mono text-fg">{pkg.aiDailyQuota}</dd>
      </dl>
      <ul className="grid gap-1.5 text-sm">
        {features.map(([name, on]) => (
          <li
            key={name}
            className={classNames(
              'flex items-center gap-2',
              on ? 'text-fg-2' : 'text-muted-dim',
            )}
          >
            {on ? (
              <Check size={14} className="text-positive" aria-hidden="true" />
            ) : (
              <Minus size={14} aria-hidden="true" />
            )}
            <span>{name}</span>
            <span className="sr-only">{on ? '✓' : '—'}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        {action === 'choose' || action === 'renew' || action === 'upgrade' ? (
          <Button className="w-full" disabled={busy} onClick={() => onBuy(pkg)}>
            {label}
          </Button>
        ) : action === 'lower' ? (
          <p className="text-center text-xs text-muted">{b.lowerTier}</p>
        ) : action === 'none' && pkg.tier !== 'FREE' ? (
          <p className="text-center text-xs text-muted">{b.notForSale}</p>
        ) : null}
      </div>
    </Card>
  );
}
