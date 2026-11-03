import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, History, UserSearch } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AuditLogEntry } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { useAuditLabels } from '../hooks/use-audit-labels';
import { ActorCell } from './AuditLogTable';
import {
  actionTone,
  changedFields,
  entityPath,
  formatValue,
  reasonOf,
} from './audit-format';

/** A value with a button that copies it, ticked for a moment once copied. */
export function CopyValue({ value, what }: { value: string; what: string }) {
  const t = useCopy().adminAuditLog;
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate font-mono text-[11px] text-fg-2">{value}</span>
      <button
        type="button"
        aria-label={formatCopy(t.copy, { what })}
        title={copied ? t.copied : formatCopy(t.copy, { what })}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-dim hover:bg-raised hover:text-fg-2"
        onClick={() =>
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
      >
        {copied ? (
          <Check size={12} aria-hidden="true" className="text-positive" />
        ) : (
          <Copy size={12} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

export function Meta({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[10px] font-medium tracking-widest text-muted-x uppercase">
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-xs text-fg-2">{children}</dd>
    </div>
  );
}

/**
 * One audit entry in full (SRS 3.11.9): when, who, what, on which object
 * and from where, then every field before and after, the changed ones
 * marked, and the stored JSON. From here the log narrows to the same actor
 * or to the history of the same object.
 */
export function AuditEntryDialog({
  entry,
  me,
  onClose,
  onFilterActor,
  onFilterEntity,
}: {
  entry: AuditLogEntry | null;
  me: string | undefined;
  onClose: () => void;
  onFilterActor: (actorId: string) => void;
  onFilterEntity: (entityType: string, entityId: string) => void;
}) {
  const t = useCopy().adminAuditLog;
  const labels = useAuditLabels();
  if (!entry)
    return (
      <Dialog open={false} onOpenChange={onClose} title={t.detailTitle}>
        {null}
      </Dialog>
    );
  const fields = changedFields(entry);
  const reason = reasonOf(entry);
  const path = entityPath(entry.entityType, entry.entityId);
  const tone = actionTone(entry.action);
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={labels.action(entry.action)}
      description={t.detailTitle + ' · ' + formatInstantLocal(entry.recordedAt)}
      size="lg"
      accent={
        tone === 'danger'
          ? 'negative'
          : tone === 'warning'
            ? 'warning'
            : tone === 'success'
              ? 'positive'
              : 'primary'
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {entry.actor && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => entry.actor && onFilterActor(entry.actor.id)}
              >
                <UserSearch size={13} aria-hidden="true" />
                {t.byThisActor}
              </Button>
            )}
            {entry.entityType && entry.entityId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  entry.entityType &&
                  entry.entityId &&
                  onFilterEntity(entry.entityType, entry.entityId)
                }
              >
                <History size={13} aria-hidden="true" />
                {t.historyOfObject}
              </Button>
            )}
          </div>
          <Button size="sm" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      }
    >
      <dl className="grid gap-4 rounded-xl border border-line bg-page-alt p-4 sm:grid-cols-2">
        <Meta label={t.detailWhen}>
          <time dateTime={entry.recordedAt} className="font-mono">
            {formatInstantLocal(entry.recordedAt)}
          </time>
          <span className="ml-2 font-mono text-[11px] text-muted-dim">
            {formatInstantUtc(entry.recordedAt)}
          </span>
        </Meta>
        <Meta label={t.detailAction}>
          <Badge tone={tone}>{labels.action(entry.action)}</Badge>
          <span className="ml-2 font-mono text-[10.5px] text-muted-x">
            {entry.action}
          </span>
        </Meta>
        <Meta label={t.detailActor}>
          <ActorCell actor={entry.actor} me={me} />
        </Meta>
        <Meta label={t.detailEntity}>
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              {labels.entity(entry.entityType)}
              {path && (
                <Link
                  to={path}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-link no-underline hover:underline"
                >
                  {t.open}
                  <ExternalLink size={11} aria-hidden="true" />
                </Link>
              )}
            </span>
            {entry.entityId && (
              <CopyValue value={entry.entityId} what={t.detailEntity} />
            )}
          </span>
        </Meta>
        <Meta label={t.detailIp}>
          {entry.ipAddress ? (
            <CopyValue value={entry.ipAddress} what={t.detailIp} />
          ) : (
            <span className="text-muted-x">{t.none}</span>
          )}
        </Meta>
        <Meta label={t.detailId}>
          <CopyValue value={entry.id} what={t.detailId} />
        </Meta>
      </dl>

      {reason && (
        <blockquote className="mt-4 rounded-lg border-l-2 border-primary bg-primary-soft px-3 py-2 text-xs text-fg-2">
          {formatCopy(t.reason, { reason })}
        </blockquote>
      )}

      <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
        {t.detailChanges}
      </h3>
      {fields.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-line bg-page-alt text-left">
                <th scope="col" className="px-3 py-2 font-medium text-muted-x">
                  {t.field}
                </th>
                <th scope="col" className="px-3 py-2 font-medium text-muted-x">
                  {t.before}
                </th>
                <th scope="col" className="px-3 py-2 font-medium text-muted-x">
                  {t.after}
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface font-mono">
              {fields.map((field) => (
                <tr
                  key={field.field}
                  className={classNames(
                    'border-b border-line align-top last:border-b-0',
                    !field.changed && 'text-muted-dim',
                  )}
                >
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-semibold text-fg-2"
                  >
                    {field.field}
                    {!field.changed && (
                      <span className="ml-1.5 font-sans text-[10px] font-normal text-muted-x">
                        {t.unchanged}
                      </span>
                    )}
                  </th>
                  <td
                    className={classNames(
                      'px-3 py-2 break-all',
                      field.changed &&
                        field.side !== 'after' &&
                        'bg-negative-soft text-negative',
                    )}
                  >
                    {field.side === 'after' ? (
                      <span className="font-sans text-muted-x italic">
                        {t.added}
                      </span>
                    ) : (
                      formatValue(field.before)
                    )}
                  </td>
                  <td
                    className={classNames(
                      'px-3 py-2 break-all',
                      field.changed &&
                        field.side !== 'before' &&
                        'bg-positive-soft text-positive',
                    )}
                  >
                    {field.side === 'before' ? (
                      <span className="font-sans text-muted-x italic">
                        {t.removed}
                      </span>
                    ) : (
                      formatValue(field.after)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-dim">{t.noValues}</p>
      )}

      {(entry.oldValue !== null || entry.newValue !== null) && (
        <details className="group mt-4 rounded-xl border border-line">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-muted select-none">
            {t.rawJson}
          </summary>
          <pre className="max-h-64 overflow-auto border-t border-line bg-page-alt p-3 font-mono text-[10.5px] leading-relaxed text-fg-2">
            {JSON.stringify(
              { oldValue: entry.oldValue, newValue: entry.newValue },
              null,
              2,
            )}
          </pre>
        </details>
      )}
    </Dialog>
  );
}
