import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AuditEntry } from '../../../types/domain';
import { describeChange } from './account-format';
import { Instant } from './UserTable';

/**
 * SCR-35 recent audit (BR-57): the latest entries about the account,
 * newest first, with who acted, what changed and the reason given.
 */
export function AccountAudit({
  entries,
  me,
}: {
  entries: readonly AuditEntry[];
  me: string | undefined;
}) {
  const copy = useCopy();
  const t = copy.adminUsers;
  const known = (
    action: string,
  ): action is
    'ACCOUNT_LOCKED' | 'ACCOUNT_UNLOCKED' | 'ACCOUNT_BANNED' | 'ROLE_CHANGED' =>
    [
      'ACCOUNT_LOCKED',
      'ACCOUNT_UNLOCKED',
      'ACCOUNT_BANNED',
      'ROLE_CHANGED',
    ].includes(action);
  const columns: Column<AuditEntry>[] = [
    {
      id: 'time',
      header: t.colTime,
      render: (entry) => <Instant value={entry.recordedAt} />,
    },
    {
      id: 'action',
      header: t.colAction,
      render: (entry) => (
        <span className="text-xs font-semibold text-fg">
          {known(entry.action) ? t[`audit${entry.action}`] : entry.action}
        </span>
      ),
    },
    {
      id: 'by',
      header: t.colBy,
      render: (entry) => (
        <span className="font-mono text-[11px] text-muted-dim">
          {entry.actorId === null
            ? t.bySystem
            : entry.actorId === me
              ? t.byYou
              : entry.actorId}
        </span>
      ),
    },
    {
      id: 'change',
      header: t.colChange,
      render: (entry) => {
        const { fields, reason } = describeChange(entry);
        return (
          <span className="flex max-w-md flex-col gap-0.5 text-[11px]">
            {fields.map((field) => (
              <span key={field.name} className="font-mono text-fg-2">
                {field.name}: {field.from} → {field.to}
              </span>
            ))}
            {reason && (
              <span className="break-words text-muted-dim">
                {formatCopy(t.changeReason, { reason })}
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: 'ip',
      header: t.colIp,
      render: (entry) => (
        <span className="font-mono text-[11px] text-muted-dim">
          {entry.ipAddress ?? '—'}
        </span>
      ),
    },
  ];
  return (
    <Table
      caption={t.auditCaption}
      columns={columns}
      rows={entries}
      rowKey={(entry) =>
        entry.recordedAt + entry.action + (entry.newValue ?? '')
      }
      emptyMessage={t.auditEmpty}
    />
  );
}
