import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AdminUserSummary } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { planTone, statusTone, userPath } from './account-format';

const actionClass =
  'inline-flex size-8 items-center justify-center rounded-lg text-muted-dim no-underline hover:bg-raised-hover hover:text-fg-2';

export function Instant({ value }: { value: string | null }) {
  const copy = useCopy();
  if (!value)
    return (
      <span className="text-xs text-muted-x">{copy.adminUsers.never}</span>
    );
  return (
    <time
      dateTime={value}
      title={formatInstantUtc(value)}
      className="text-xs whitespace-nowrap text-muted-dim"
    >
      {formatInstantLocal(value)}
    </time>
  );
}

/**
 * SCR-34 (UC-42): a page of accounts with role, effective plan, status,
 * email verification, last sign-in and creation; each row opens SCR-35,
 * where the status and role change. Layout from the Figma admin users
 * table without its invented columns (country, id, invite, delete).
 */
export function UserTable({
  accounts,
  me,
  emptyMessage,
}: {
  accounts: readonly AdminUserSummary[];
  /** The signed-in administrator, tagged "You". */
  me: string | undefined;
  emptyMessage: string;
}) {
  const copy = useCopy();
  const t = copy.adminUsers;
  const columns: Column<AdminUserSummary>[] = [
    {
      id: 'account',
      header: t.colAccount,
      render: (account) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5">
            <Link
              to={userPath(account.userId)}
              className="truncate text-xs font-semibold text-fg no-underline hover:underline"
            >
              {account.displayName ?? t.noName}
            </Link>
            {account.userId === me && <Badge tone="info">{t.you}</Badge>}
          </span>
          <span className="truncate text-[11px] text-muted-dim">
            {account.email}
          </span>
        </span>
      ),
    },
    {
      id: 'role',
      header: t.colRole,
      render: (account) => (
        <Badge tone={account.role === 'Admin' ? 'info' : 'neutral'}>
          {t[`role${account.role}`]}
        </Badge>
      ),
    },
    {
      id: 'plan',
      header: t.colPlan,
      render: (account) => (
        <Badge tone={planTone[account.plan]}>{t[`plan${account.plan}`]}</Badge>
      ),
    },
    {
      id: 'status',
      header: t.colStatus,
      render: (account) => (
        <Badge tone={statusTone[account.status]} withDot>
          {t[`status${account.status}`]}
        </Badge>
      ),
    },
    {
      id: 'verified',
      header: t.colVerified,
      render: (account) => (
        <span
          className={
            account.emailVerified ? 'text-xs text-fg-2' : 'text-xs text-warning'
          }
        >
          {account.emailVerified ? t.verified : t.unverified}
        </span>
      ),
    },
    {
      id: 'lastLogin',
      header: t.colLastLogin,
      render: (account) => <Instant value={account.lastLoginAt} />,
    },
    {
      id: 'joined',
      header: t.colJoined,
      render: (account) => <Instant value={account.createdAt} />,
    },
    {
      id: 'actions',
      header: t.colActions,
      render: (account) => (
        <Link
          to={userPath(account.userId)}
          className={actionClass}
          aria-label={formatCopy(t.view, { email: account.email })}
          title={formatCopy(t.view, { email: account.email })}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ),
    },
  ];
  return (
    <Table
      caption={t.tableCaption}
      columns={columns}
      rows={accounts}
      rowKey={(account) => account.userId}
      emptyMessage={emptyMessage}
    />
  );
}
