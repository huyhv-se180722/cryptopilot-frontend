import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Lock, ShieldCheck, Unlock, User } from 'lucide-react';
import { Alert, ErrorState } from '../../components/feedback/States';
import { StatCard } from '../../components/layout/StatCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  AccountActionDialog,
  type AccountChange,
} from '../../features/admin/components/AccountActionDialog';
import { AccountAudit } from '../../features/admin/components/AccountAudit';
import { Instant } from '../../features/admin/components/UserTable';
import {
  planTone,
  statusTone,
} from '../../features/admin/components/account-format';
import { useAdminUser } from '../../features/admin/hooks/use-admin-users';
import { useAuth } from '../../hooks/use-auth';
import { useCopy } from '../../hooks/use-copy';
import { errorText } from '../../i18n/messages';
import type { AdminUserDetail } from '../../types/domain';

const KNOWN_ACTIVITY = ['plans', 'trades', 'posts'] as const;
type KnownActivity = (typeof KNOWN_ACTIVITY)[number];
const isKnown = (name: string): name is KnownActivity =>
  (KNOWN_ACTIVITY as readonly string[]).includes(name);

/**
 * SCR-35 User Detail (SRS 3.11.1, UC-42): the account with its role,
 * status and plan, its activity counts, profile and latest audit entries;
 * Lock, Unlock, Ban and the role change each ask for a reason (MSG39).
 * One's own account shows no change (BR-58); the server also refuses
 * one for the last active administrator. No Figma frame: the layout
 * follows the admin detail pattern.
 */
export function AdminUserPage() {
  const copy = useCopy();
  const t = copy.adminUsers;
  const { userId = '' } = useParams();
  const user = useAdminUser(userId);

  return (
    <div className="w-full">
      <Link
        to="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted no-underline hover:text-fg-2"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {t.back}
      </Link>
      {user.isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : user.isError ? (
        (user.error as { status?: number } | null)?.status === 404 ? (
          <Alert tone="info" title={t.notFound} />
        ) : (
          <ErrorState
            message={errorText(copy, user.error)}
            onRetry={() => void user.refetch()}
          />
        )
      ) : (
        <Account detail={user.data} />
      )}
    </div>
  );
}

function Account({ detail }: { detail: AdminUserDetail }) {
  const copy = useCopy();
  const t = copy.adminUsers;
  const p = copy.profile;
  const me = useAuth().session?.user.id;
  const [change, setChange] = useState<AccountChange | null>(null);
  const account = detail.account;
  const own = account.userId === me;
  const activity = Object.entries(detail.activity);

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-raised text-muted"
          >
            <User size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-fg">
              {account.displayName ?? t.noName}
            </h1>
            <p className="truncate text-xs text-muted-dim">{account.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={account.role === 'Admin' ? 'info' : 'neutral'}>
                {t[`role${account.role}`]}
              </Badge>
              <Badge tone={statusTone[account.status]} withDot>
                {t[`status${account.status}`]}
              </Badge>
              {own && <Badge tone="info">{t.you}</Badge>}
            </div>
          </div>
        </div>
        {!own && (
          <div className="flex flex-wrap gap-2">
            {account.status === 'active' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChange({ kind: 'lock' })}
              >
                <Lock size={13} aria-hidden="true" />
                {t.lock}
              </Button>
            )}
            {account.status === 'locked' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setChange({ kind: 'unlock' })}
              >
                <Unlock size={13} aria-hidden="true" />
                {t.unlock}
              </Button>
            )}
            {account.status !== 'banned' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setChange({ kind: 'ban' })}
              >
                <Ban size={13} aria-hidden="true" />
                {t.ban}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setChange({
                  kind: 'role',
                  role: account.role === 'Admin' ? 'Trader' : 'Admin',
                })
              }
            >
              <ShieldCheck size={13} aria-hidden="true" />
              {account.role === 'Admin' ? t.makeTrader : t.makeAdmin}
            </Button>
          </div>
        )}
      </header>
      {own && <Alert tone="info" title={t.ownAccount} className="mb-5" />}

      <section aria-label={t.statsCaption} className="mb-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t.currentPlan}
            value={
              <Badge tone={planTone[account.plan]}>
                {t[`plan${account.plan}`]}
              </Badge>
            }
            accent="accent"
          />
          {activity.map(([name, count]) => (
            <StatCard
              key={name}
              label={isKnown(name) ? t[`activity${name}`] : name}
              value={String(count)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <SectionTitle>{t.profileTitle}</SectionTitle>
          <dl className="grid gap-3 text-xs">
            <Row label={t.email}>
              <span className="break-all text-fg-2">{account.email}</span>{' '}
              <span
                className={
                  account.emailVerified ? 'text-muted-dim' : 'text-warning'
                }
              >
                ({account.emailVerified ? t.verified : t.unverified})
              </span>
            </Row>
            <Row label={t.tradingStyle}>
              {detail.tradingStyle
                ? p[`style${detail.tradingStyle}`]
                : t.notSet}
            </Row>
            <Row label={t.riskProfile}>
              {detail.riskProfile ? p[`risk${detail.riskProfile}`] : t.notSet}
            </Row>
            <Row label={t.joined}>
              <Instant value={account.createdAt} />
            </Row>
            <Row label={t.lastLogin}>
              <Instant value={account.lastLoginAt} />
            </Row>
            <Row label={t.accountId}>
              <span className="font-mono text-[11px] break-all text-muted-dim">
                {account.userId}
              </span>
            </Row>
          </dl>
        </Card>
        <section className="min-w-0">
          <SectionTitle>{t.auditTitle}</SectionTitle>
          <p className="-mt-3 mb-3 text-[11px] text-muted-dim">{t.auditHint}</p>
          <AccountAudit entries={detail.recentAudit} me={me} />
        </section>
      </div>

      <AccountActionDialog
        account={account}
        change={change}
        onClose={() => setChange(null)}
      />
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-dim">{label}</dt>
      <dd className="m-0 text-fg-2">{children}</dd>
    </div>
  );
}
