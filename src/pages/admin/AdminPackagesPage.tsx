import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, type Column } from '../../components/ui/Table';
import {
  PackageConfirmDialog,
  PackageFormDialog,
  TierLimitsDialog,
} from '../../features/admin/components/PackageDialogs';
import {
  FEATURE_FIELDS,
  featureLabel,
  tierGroups,
  tierName,
  type TierGroup,
} from '../../features/admin/components/package-form';
import {
  PACKAGE_TIERS,
  useAdminPackages,
  useSetPackageActive,
  type AdminPackage,
} from '../../features/admin/hooks/use-admin-packages';
import { vnd } from '../../features/subscription/components/billing-format';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type { PlanTier } from '../../types/domain';
import { formatInstantLocal } from '../../utils/instant-format';

type Editing = { pkg: AdminPackage | null } | null;
type Confirming = {
  action: 'deactivate' | 'delete';
  pkg: AdminPackage;
} | null;

/**
 * SCR-39 Packages (UC-42): every subscription package, inactive ones
 * included, lowest tier first, and the limits of each tier (BR-62). An
 * Admin creates a paid package, edits one, takes it off sale or back, and
 * deletes one no order was placed for; the FREE package stays active and
 * takes a new name only. Limits belong to the tier: saving them changes
 * every package of the tier at once. Every change is audited (BR-57).
 */
export function AdminPackagesPage() {
  const copy = useCopy();
  const t = copy.adminPackages;
  const packages = useAdminPackages();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [limitsOf, setLimitsOf] = useState<TierGroup | null>(null);
  const activate = useSetPackageActive();
  const { show } = useToast();

  async function reactivate(pkg: AdminPackage) {
    const result = await activate.run(pkg.id, true);
    show(
      result.status === 'success'
        ? {
            tone: 'success',
            message: formatCopy(t.activated, { name: pkg.name }),
          }
        : {
            tone: 'error',
            message: errorText(
              copy,
              result.status === 'error' ? result.error : null,
            ),
          },
    );
  }

  const columns: readonly Column<AdminPackage>[] = [
    {
      id: 'code',
      header: t.colCode,
      render: (p) => <span className="font-mono">{p.code}</span>,
    },
    { id: 'name', header: t.colName, render: (p) => p.name },
    { id: 'tier', header: t.colTier, render: (p) => tierName(copy, p.tier) },
    {
      id: 'price',
      header: t.colPrice,
      numeric: true,
      render: (p) => (p.tier === 'FREE' ? t.free : vnd(p.price)),
    },
    {
      id: 'duration',
      header: t.colDuration,
      render: (p) =>
        p.durationDays === null
          ? t.forever
          : formatCopy(t.days, { n: p.durationDays }),
    },
    {
      id: 'offer',
      header: t.colOffer,
      render: (p) =>
        p.purchasable ? (
          <Badge tone="info">{t.onSale}</Badge>
        ) : (
          <Badge tone="neutral">{t.notOnSale}</Badge>
        ),
    },
    {
      id: 'status',
      header: t.colStatus,
      render: (p) =>
        p.active ? (
          <Badge tone="success">{t.active}</Badge>
        ) : (
          <Badge tone="neutral">{t.inactive}</Badge>
        ),
    },
    {
      id: 'orders',
      header: t.colOrders,
      render: (p) => (p.hasOrders ? t.hasOrders : t.noOrders),
    },
    {
      id: 'updated',
      header: t.colUpdated,
      render: (p) => formatInstantLocal(p.updatedAt),
    },
    {
      id: 'actions',
      header: t.colActions,
      render: (p) => {
        const free = p.tier === 'FREE';
        return (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              aria-label={t.edit + ' ' + p.name}
              onClick={() => setEditing({ pkg: p })}
            >
              {t.edit}
            </Button>
            {!free &&
              (p.active ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t.deactivate + ' ' + p.name}
                  onClick={() =>
                    setConfirming({ action: 'deactivate', pkg: p })
                  }
                >
                  {t.deactivate}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t.activate + ' ' + p.name}
                  disabled={activate.pending}
                  onClick={() => void reactivate(p)}
                >
                  {t.activate}
                </Button>
              ))}
            {!free && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={t.remove + ' ' + p.name}
                disabled={p.hasOrders}
                title={p.hasOrders ? t.inUseHint : undefined}
                onClick={() => setConfirming({ action: 'delete', pkg: p })}
              >
                {t.remove}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={t.title}
        description={t.subtitle}
        actions={
          <Button onClick={() => setEditing({ pkg: null })}>
            <Plus size={14} aria-hidden="true" />
            {t.create}
          </Button>
        }
      />
      {packages.isPending ? (
        <Card padding="none" className="grid gap-2 p-3">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </Card>
      ) : packages.isError ? (
        <Card padding="none" className="p-3">
          <ErrorState
            message={errorText(copy, packages.error)}
            onRetry={() => void packages.refetch()}
          />
        </Card>
      ) : (
        <div className="grid gap-6">
          <Card padding="none" className="p-3">
            <Table
              caption={t.caption}
              columns={columns}
              rows={packages.data}
              rowKey={(p) => p.id}
              emptyMessage={t.empty}
              cards
            />
          </Card>
          <section aria-labelledby="tier-limits-title">
            <div id="tier-limits-title">
              <SectionTitle>{t.tiersTitle}</SectionTitle>
            </div>
            <p className="-mt-2 mb-4 text-xs text-muted">{t.tiersSubtitle}</p>
            <div className="grid gap-4 lg:grid-cols-3">
              {tierGroups(packages.data, PACKAGE_TIERS).map((group) => (
                <TierCard
                  key={group.tier}
                  group={group}
                  onEdit={() => setLimitsOf(group)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
      <PackageFormDialog
        open={editing !== null}
        pkg={editing?.pkg ?? null}
        onClose={() => setEditing(null)}
      />
      <PackageConfirmDialog
        action={confirming?.action ?? 'deactivate'}
        pkg={confirming?.pkg ?? null}
        onClose={() => setConfirming(null)}
      />
      <TierLimitsDialog
        tier={limitsOf?.tier ?? null}
        limits={limitsOf?.limits ?? null}
        onClose={() => setLimitsOf(null)}
      />
    </div>
  );
}

function TierCard({ group, onEdit }: { group: TierGroup; onEdit: () => void }) {
  const copy = useCopy();
  const t = copy.adminPackages;
  const b = copy.billing;
  const { limits } = group;
  const name = tierName(copy, group.tier as PlanTier);
  const count = (n: number | null) => (n === null ? b.unlimited : String(n));
  return (
    <Card padding="lg" className="flex flex-col gap-3" aria-label={name}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-fg">{name}</h3>
          <p className="text-xs text-muted-dim">
            {group.packages.length === 1
              ? t.tierPackagesOne
              : formatCopy(t.tierPackages, { n: group.packages.length })}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={limits === null}
          aria-label={t.editLimits + ' ' + name}
          onClick={onEdit}
        >
          {t.editLimits}
        </Button>
      </div>
      {limits === null ? (
        <p className="text-xs text-muted">{t.noTierPackage}</p>
      ) : (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-muted">{t.planMax}</dt>
          <dd className="text-right font-mono text-fg">
            {count(limits.activePlanMax)}
          </dd>
          <dt className="text-muted">{t.watchlistMax}</dt>
          <dd className="text-right font-mono text-fg">
            {count(limits.watchlistMax)}
          </dd>
          <dt className="text-muted">{t.alertMax}</dt>
          <dd className="text-right font-mono text-fg">
            {count(limits.activeAlertMax)}
          </dd>
          <dt className="text-muted">{t.aiQuota}</dt>
          <dd className="text-right font-mono text-fg">
            {limits.aiDailyQuota}
          </dd>
          {FEATURE_FIELDS.map((field) => (
            <div key={field} className="contents">
              <dt className="text-muted">{featureLabel(copy, field)}</dt>
              <dd className="text-right text-fg">
                {limits[field] ? t.included : t.notIncluded}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
