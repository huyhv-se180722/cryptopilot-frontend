import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Table, type Column } from '../../../components/ui/Table';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { SystemEvent } from '../../../types/domain';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { CopyValue, Meta } from './AuditEntryDialog';
import { Instant } from './UserTable';

const errorClass = (type: string) => type.slice(type.lastIndexOf('.') + 1);

/**
 * SCR-44 system log (UC-46): unexpected errors, failed jobs and failed
 * calls to external services, the latest seen first; a failure that
 * repeated is one row with its count.
 */
export function SystemEventTable({
  events,
  emptyMessage,
  onOpen,
}: {
  events: readonly SystemEvent[];
  emptyMessage: string;
  onOpen: (event: SystemEvent) => void;
}) {
  const t = useCopy().adminAuditLog;
  const columns: Column<SystemEvent>[] = [
    {
      id: 'lastSeen',
      header: t.colLastSeen,
      render: (event) => <Instant value={event.lastSeenAt} />,
    },
    {
      id: 'source',
      header: t.colSource,
      render: (event) => (
        <span className="text-xs font-semibold text-fg-2">
          {t[`source${event.source}`]}
        </span>
      ),
    },
    {
      id: 'kind',
      header: t.colKind,
      render: (event) => (
        <Badge
          tone={event.category === 'SYSTEM_ERROR' ? 'danger' : 'warning'}
          withDot
        >
          {t[`category${event.category}`]}
        </Badge>
      ),
    },
    {
      id: 'operation',
      header: t.colOperation,
      render: (event) => (
        <span
          className="block max-w-56 truncate font-mono text-[11px] text-fg-2"
          title={event.operation}
        >
          {event.operation}
        </span>
      ),
    },
    {
      id: 'message',
      header: t.colMessage,
      render: (event) => (
        <span className="flex max-w-sm flex-col">
          <span className="font-mono text-[10.5px] text-muted-dim">
            {errorClass(event.errorType)}
          </span>
          <span
            className="truncate text-[11px] text-fg-2"
            title={event.message ?? undefined}
          >
            {event.message ?? t.noMessage}
          </span>
        </span>
      ),
    },
    {
      id: 'count',
      header: t.colCount,
      numeric: true,
      render: (event) => (
        <span
          className={
            event.occurrences > 1 ? 'font-semibold text-negative' : 'text-fg-2'
          }
        >
          {formatCopy(t.times, { n: event.occurrences })}
        </span>
      ),
    },
  ];
  return (
    <Table
      caption={t.eventsCaption}
      columns={columns}
      rows={events}
      rowKey={(event) => event.id}
      emptyMessage={emptyMessage}
      onRowClick={onOpen}
    />
  );
}

/** One row of the system log in full, with the reference to look up. */
export function SystemEventDialog({
  event,
  onClose,
}: {
  event: SystemEvent | null;
  onClose: () => void;
}) {
  const t = useCopy().adminAuditLog;
  return (
    <Dialog
      open={event !== null}
      onOpenChange={(open) => !open && onClose()}
      title={event ? t[`source${event.source}`] : t.eventTitle}
      {...(event
        ? {
            description:
              t.eventTitle + ' · ' + formatInstantLocal(event.lastSeenAt),
          }
        : {})}
      size="lg"
      accent={event?.category === 'SYSTEM_ERROR' ? 'negative' : 'warning'}
      footer={
        <Button size="sm" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {event && (
        <>
          <dl className="grid gap-4 rounded-xl border border-line bg-page-alt p-4 sm:grid-cols-2">
            <Meta label={t.colKind}>
              <Badge
                tone={event.category === 'SYSTEM_ERROR' ? 'danger' : 'warning'}
                withDot
              >
                {t[`category${event.category}`]}
              </Badge>
            </Meta>
            <Meta label={t.occurrences}>
              <span className="font-mono font-semibold">
                {event.occurrences}
              </span>
              <span className="ml-2 text-[11px] text-muted-dim">
                {t.mergedHint}
              </span>
            </Meta>
            <Meta label={t.firstSeen}>
              <time
                dateTime={event.firstSeenAt}
                title={formatInstantUtc(event.firstSeenAt)}
                className="font-mono"
              >
                {formatInstantLocal(event.firstSeenAt)}
              </time>
            </Meta>
            <Meta label={t.lastSeen}>
              <time
                dateTime={event.lastSeenAt}
                title={formatInstantUtc(event.lastSeenAt)}
                className="font-mono"
              >
                {formatInstantLocal(event.lastSeenAt)}
              </time>
            </Meta>
            <Meta label={t.operation}>
              <span className="font-mono text-[11px] break-all">
                {event.operation}
              </span>
            </Meta>
            <Meta label={t.errorType}>
              <span className="font-mono text-[11px] break-all">
                {event.errorType}
              </span>
            </Meta>
          </dl>
          <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
            {t.message}
          </h3>
          <pre className="max-h-48 overflow-auto rounded-xl border border-line bg-page-alt p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-fg-2">
            {event.message ?? t.noMessage}
          </pre>
          {event.reference && (
            <div className="mt-4 rounded-xl border border-primary-line bg-primary-soft p-3">
              <p className="mb-1 text-[10px] font-semibold tracking-widest text-primary uppercase">
                {t.reference}
              </p>
              <CopyValue value={event.reference} what={t.reference} />
              <p className="mt-1 text-[11px] text-muted">{t.referenceHint}</p>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
