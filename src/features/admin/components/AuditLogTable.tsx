import { Cpu } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AuditActor, AuditLogEntry } from '../../../types/domain';
import {
  actionTone,
  formatValue,
  initials,
  reasonOf,
  shortId,
  summaryFields,
} from './audit-format';
import { useAuditLabels } from '../hooks/use-audit-labels';
import { Instant } from './UserTable';

/** The most changed fields a row shows before "+n more". */
const SUMMARY_FIELDS = 2;

/** An actor as a small avatar with the name and email, or "System". */
export function ActorCell({
  actor,
  me,
}: {
  actor: AuditActor | null;
  me: string | undefined;
}) {
  const t = useCopy().adminAuditLog;
  if (actor === null)
    return (
      <span className="flex items-center gap-2" title={t.systemHint}>
        <span
          aria-hidden="true"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-muted-dim"
        >
          <Cpu size={13} />
        </span>
        <span className="text-xs font-semibold text-fg-2">{t.system}</span>
      </span>
    );
  const name = actor.displayName ?? actor.email ?? t.goneAccount;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary"
      >
        {initials(actor.displayName, actor.email)}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5">
          <span className="max-w-44 truncate text-xs font-semibold text-fg">
            {name}
          </span>
          {actor.id === me && <Badge tone="info">{t.you}</Badge>}
          {actor.role === 'ADMIN' && actor.id !== me && (
            <span className="rounded border border-line px-1 text-[9px] font-semibold tracking-wide text-muted-dim uppercase">
              Admin
            </span>
          )}
        </span>
        <span className="max-w-52 truncate text-[11px] text-muted-dim">
          {actor.email ?? shortId(actor.id)}
        </span>
      </span>
    </span>
  );
}

/**
 * SCR-44 audit trail (SRS 3.11.9): time, actor, action, object, the changed
 * fields and the IP address of each entry, newest first. A row opens the
 * entry with every field before and after.
 */
export function AuditLogTable({
  entries,
  me,
  emptyMessage,
  onOpen,
}: {
  entries: readonly AuditLogEntry[];
  me: string | undefined;
  emptyMessage: string;
  onOpen: (entry: AuditLogEntry) => void;
}) {
  const t = useCopy().adminAuditLog;
  const labels = useAuditLabels();
  const columns: Column<AuditLogEntry>[] = [
    {
      id: 'time',
      header: t.colTime,
      render: (entry) => <Instant value={entry.recordedAt} />,
    },
    {
      id: 'actor',
      header: t.colActor,
      render: (entry) => <ActorCell actor={entry.actor} me={me} />,
    },
    {
      id: 'action',
      header: t.colAction,
      render: (entry) => (
        <Badge tone={actionTone(entry.action)}>
          {labels.action(entry.action)}
        </Badge>
      ),
    },
    {
      id: 'entity',
      header: t.colEntity,
      render: (entry) => (
        <span className="flex flex-col">
          <span className="text-xs text-fg-2">
            {labels.entity(entry.entityType)}
          </span>
          {entry.entityId && (
            <span
              className="font-mono text-[10.5px] text-muted-dim"
              title={entry.entityId}
            >
              {shortId(entry.entityId)}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'change',
      header: t.colChange,
      render: (entry) => <ChangeSummary entry={entry} />,
    },
    {
      id: 'ip',
      header: t.colIp,
      render: (entry) => (
        <span className="font-mono text-[11px] text-muted-dim">
          {entry.ipAddress ?? t.none}
        </span>
      ),
    },
  ];
  return (
    <Table
      caption={t.tableCaption}
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.id}
      emptyMessage={emptyMessage}
      onRowClick={onOpen}
    />
  );
}

function ChangeSummary({ entry }: { entry: AuditLogEntry }) {
  const t = useCopy().adminAuditLog;
  const fields = summaryFields(entry);
  const reason = reasonOf(entry);
  if (!fields.length && !reason)
    return <span className="text-[11px] text-muted-x">{t.noValues}</span>;
  return (
    <span className="flex max-w-md flex-col gap-0.5 text-[11px] whitespace-normal">
      {fields.slice(0, SUMMARY_FIELDS).map((field) => (
        <span key={field.field} className="truncate font-mono text-fg-2">
          <span className="text-muted-dim">{field.field}</span>{' '}
          {field.side !== 'after' && (
            <span className="text-negative line-through decoration-negative/40">
              {formatValue(field.before)}
            </span>
          )}
          {field.side === 'both' && (
            <span className="px-1 text-muted-x">→</span>
          )}
          {field.side !== 'before' && (
            <span className="text-positive">{formatValue(field.after)}</span>
          )}
        </span>
      ))}
      {fields.length > SUMMARY_FIELDS && (
        <span className="text-muted-dim">
          {formatCopy(t.moreFields, { n: fields.length - SUMMARY_FIELDS })}
        </span>
      )}
      {reason && (
        <span className="line-clamp-1 text-muted-dim" title={reason}>
          {formatCopy(t.reason, { reason })}
        </span>
      )}
    </span>
  );
}
