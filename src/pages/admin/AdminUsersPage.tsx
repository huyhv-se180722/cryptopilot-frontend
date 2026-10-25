import { useDeferredValue, useState } from 'react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { UserTable } from '../../features/admin/components/UserTable';
import { useAdminUsers } from '../../features/admin/hooks/use-admin-users';
import { useAuth } from '../../hooks/use-auth';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type {
  AccountRole,
  AccountStatus,
  AdminUserQuery,
  PlanTier,
} from '../../types/domain';

const ROLES: readonly AccountRole[] = ['Trader', 'Admin'];
const STATUSES: readonly AccountStatus[] = ['active', 'locked', 'banned'];
const PLANS: readonly PlanTier[] = ['FREE', 'PRO', 'PREMIUM'];

/**
 * SCR-34 Users (SRS 3.11.1, UC-42): every account, newest first, searched
 * by email or display name and filtered by role, status and effective
 * plan, 20 a page from the server. A row opens SCR-35. Layout from the
 * Figma admin users table; data from the API.
 */
export function AdminUsersPage() {
  const copy = useCopy();
  const t = copy.adminUsers;
  const me = useAuth().session?.user.id;
  const [typed, setTyped] = useState('');
  const q = useDeferredValue(typed.trim());
  const [role, setRole] = useState<AccountRole | ''>('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [plan, setPlan] = useState<PlanTier | ''>('');
  const [page, setPage] = useState(1);
  const query: AdminUserQuery = {
    page,
    ...(q ? { q } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(plan ? { plan } : {}),
  };
  const filtered = Boolean(q || role || status || plan);
  const users = useAdminUsers(query);
  const total = users.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (users.data?.pageSize || 20)));
  if (users.data && !users.isPlaceholderData && page > pages) setPage(pages);
  // A new search or filter starts again from the first page.
  const filter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={t.title}
        description={t.subtitle}
        {...(users.data
          ? {
              actions: (
                <span className="text-xs text-muted-dim">
                  {total === 1 ? t.totalOne : formatCopy(t.total, { n: total })}
                </span>
              ),
            }
          : {})}
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        <div className="lg:w-72">
          <Input
            label={t.searchLabel}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            type="search"
            value={typed}
            onChange={(event) => filter(setTyped)(event.target.value)}
          />
        </div>
        <div className="lg:w-40">
          <Select
            label={t.roleFilter}
            value={role}
            onChange={(event) =>
              filter(setRole)(event.target.value as AccountRole | '')
            }
          >
            <option value="">{t.any}</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {t[`role${value}`]}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-40">
          <Select
            label={t.statusFilter}
            value={status}
            onChange={(event) =>
              filter(setStatus)(event.target.value as AccountStatus | '')
            }
          >
            <option value="">{t.any}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t[`status${value}`]}
              </option>
            ))}
          </Select>
        </div>
        <div className="lg:w-40">
          <Select
            label={t.planFilter}
            value={plan}
            onChange={(event) =>
              filter(setPlan)(event.target.value as PlanTier | '')
            }
          >
            <option value="">{t.any}</option>
            {PLANS.map((value) => (
              <option key={value} value={value}>
                {t[`plan${value}`]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {users.isPending ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3, 4].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      ) : users.isError ? (
        <ErrorState
          message={errorText(copy, users.error)}
          onRetry={() => void users.refetch()}
        />
      ) : (
        <>
          <UserTable
            accounts={users.data.items}
            me={me}
            emptyMessage={filtered ? t.emptyFiltered : t.empty}
          />
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-dim">
              <span>{formatCopy(t.pageOf, { page, pages })}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t.previous}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t.next}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
