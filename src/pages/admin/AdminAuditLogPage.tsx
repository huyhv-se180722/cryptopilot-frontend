import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, RefreshCw, X } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { AuditEntryDialog } from '../../features/admin/components/AuditEntryDialog';
import { AuditLogTable } from '../../features/admin/components/AuditLogTable';
import { useAuditLabels } from '../../features/admin/hooks/use-audit-labels';
import {
  AUDIT_ACTION_GROUPS,
  AUDITED_ENTITIES,
  SYSTEM_EVENT_SOURCES,
  shortId,
  type AuditActionGroup,
} from '../../features/admin/components/audit-format';
import { SystemHealthPanel } from '../../features/admin/components/SystemHealthPanel';
import {
  SystemEventDialog,
  SystemEventTable,
} from '../../features/admin/components/SystemEventTable';
import {
  useAuditLog,
  useExportAuditLog,
  useSystemEvents,
  useSystemHealth,
} from '../../features/admin/hooks/use-admin-audit';
import { useAuth } from '../../hooks/use-auth';
import { useCopy, useLocale } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import type {
  AuditActorType,
  AuditLogEntry,
  AuditLogQuery,
  SystemEvent,
  SystemEventCategory,
  SystemEventSource,
} from '../../types/domain';
import { formatInstantLocal } from '../../utils/instant-format';

type Tab = 'audit' | 'events';

/**
 * SCR-44 Audit Log (UC-46, SRS 3.11.9; registration form: "system logs,
 * including important user actions, system errors, and external API
 * failures"). On top the health of the external services and the market
 * data feeds, read again every 30 seconds; below, in two tabs, the audit
 * trail, filtered by actor, action, object and period with a CSV export,
 * and the system log of failures. Read only. A link may open it on one
 * actor or one object with `?actorId=` or `?entityType=&entityId=`, and on
 * the system log with `?tab=events`.
 */
export function AdminAuditLogPage() {
  const copy = useCopy();
  const t = copy.adminAuditLog;
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'events' ? 'events' : 'audit';
  const health = useSystemHealth();

  return (
    <div className="w-full">
      <PageHeader
        size="sm"
        title={t.title}
        description={t.subtitle}
        actions={
          <div className="flex items-center gap-3">
            {health.data && (
              <span className="text-[11px] text-muted-dim">
                {formatCopy(t.checkedAt, {
                  time: formatInstantLocal(health.data.checkedAt),
                })}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={health.isFetching}
              onClick={() => void health.refetch()}
            >
              <RefreshCw
                size={13}
                aria-hidden="true"
                className={health.isFetching ? 'animate-spin' : undefined}
              />
              {t.refresh}
            </Button>
          </div>
        }
      />
      <div className="mb-6">
        {health.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((k) => (
              <Skeleton key={k} className="h-36 w-full" />
            ))}
          </div>
        ) : health.isError ? (
          <ErrorState
            message={errorText(copy, health.error)}
            onRetry={() => void health.refetch()}
          />
        ) : (
          <SystemHealthPanel health={health.data} />
        )}
      </div>
      <Tabs
        label={t.tabsLabel}
        value={tab}
        onChange={(id) =>
          setParams(
            (current) => {
              const next = new URLSearchParams(current);
              if (id === 'events') next.set('tab', 'events');
              else next.delete('tab');
              return next;
            },
            { replace: true },
          )
        }
        items={[
          { id: 'audit', label: t.tabAudit, panel: <AuditTrail /> },
          { id: 'events', label: t.tabEvents, panel: <SystemLog /> },
        ]}
      />
      <p className="mt-4 text-[11px] text-muted-x">{t.retention}</p>
    </div>
  );
}

const ACTOR_TYPES: readonly ('' | AuditActorType)[] = ['', 'USER', 'SYSTEM'];

function AuditTrail() {
  const copy = useCopy();
  const t = copy.adminAuditLog;
  const labels = useAuditLabels();
  const me = useAuth().session?.user.id;
  const [params] = useSearchParams();
  const [typed, setTyped] = useState('');
  const actor = useDeferredValue(typed.trim());
  const [actorId, setActorId] = useState(params.get('actorId') ?? '');
  const [actorType, setActorType] = useState<'' | AuditActorType>('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState(params.get('entityType') ?? '');
  const [entityId, setEntityId] = useState(params.get('entityId') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditLogEntry | null>(null);
  const backwards = Boolean(from && to && from > to);
  const filters: Omit<AuditLogQuery, 'page'> = {
    ...(actor ? { actor } : {}),
    ...(actorId ? { actorId } : {}),
    ...(actorType ? { actorType } : {}),
    ...(action ? { actions: [action] } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(from && !backwards ? { from } : {}),
    ...(to && !backwards ? { to } : {}),
  };
  const filtered = Object.keys(filters).length > 0;
  const log = useAuditLog({ page, ...filters });
  const total = log.data?.total ?? 0;
  const pageSize = log.data?.pageSize || 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (log.data && !log.isPlaceholderData && page > pages) setPage(pages);
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };
  const clear = () => {
    setTyped('');
    setActorId('');
    setActorType('');
    setAction('');
    setEntityType('');
    setEntityId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <div>
      <div className="mb-3 rounded-xl border border-line bg-surface p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_repeat(2,9.5rem)]">
          <Input
            label={t.actorLabel}
            placeholder={t.actorPlaceholder}
            type="search"
            autoComplete="off"
            value={typed}
            onChange={(event) => change(setTyped)(event.target.value)}
          />
          <Select
            label={t.actionLabel}
            value={action}
            onChange={(event) => change(setAction)(event.target.value)}
          >
            <option value="">{t.any}</option>
            {(Object.keys(AUDIT_ACTION_GROUPS) as AuditActionGroup[]).map(
              (group) => (
                <optgroup key={group} label={t[`group${group}`]}>
                  {AUDIT_ACTION_GROUPS[group].map((value) => (
                    <option key={value} value={value}>
                      {labels.action(value)}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </Select>
          <Select
            label={t.entityLabel}
            value={entityType}
            onChange={(event) => {
              change(setEntityType)(event.target.value);
              setEntityId('');
            }}
          >
            <option value="">{t.any}</option>
            {AUDITED_ENTITIES.map((value) => (
              <option key={value} value={value}>
                {labels.entity(value)}
              </option>
            ))}
          </Select>
          <Input
            label={t.fromLabel}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => change(setFrom)(event.target.value)}
          />
          <Input
            label={t.toLabel}
            type="date"
            value={to}
            min={from || undefined}
            error={backwards ? t.periodBackwards : undefined}
            onChange={(event) => change(setTo)(event.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<'' | AuditActorType>
              label={t.actorTypeLabel}
              value={actorType}
              onChange={change(setActorType)}
              options={ACTOR_TYPES.map((value) => ({
                value,
                label: value ? t[`actorType${value}`] : t.actorTypeAll,
              }))}
            />
            {actorId && (
              <Chip
                label={t.actorLabel + ': ' + shortId(actorId)}
                title={actorId}
                onRemove={() => change(setActorId)('')}
              />
            )}
            {entityId && (
              <Chip
                label={
                  labels.entity(entityType || null) + ': ' + shortId(entityId)
                }
                title={entityId}
                onRemove={() => change(setEntityId)('')}
              />
            )}
            {filtered && (
              <Button variant="ghost" size="sm" onClick={clear}>
                {t.clearFilters}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {log.data && (
              <span className="text-xs text-muted-dim">
                {total === 1 ? t.totalOne : formatCopy(t.total, { n: total })}
              </span>
            )}
            <ExportButton
              filters={filters}
              disabled={backwards || total === 0}
            />
          </div>
        </div>
      </div>
      {log.data?.actorsTruncated && (
        <p
          role="status"
          className="rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning"
        >
          {t.actorsCut}
        </p>
      )}
      {log.isPending ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <Skeleton key={k} className="h-14 w-full" />
          ))}
        </div>
      ) : log.isError ? (
        <ErrorState
          message={errorText(copy, log.error)}
          onRetry={() => void log.refetch()}
        />
      ) : (
        <div
          className={
            log.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined
          }
        >
          <AuditLogTable
            entries={log.data.items}
            me={me}
            emptyMessage={filtered ? t.emptyFiltered : t.empty}
            onOpen={setOpen}
          />
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
            disabled={log.isFetching}
          />
        </div>
      )}
      <AuditEntryDialog
        entry={open}
        me={me}
        onClose={() => setOpen(null)}
        onFilterActor={(id) => {
          setOpen(null);
          setTyped('');
          setActorType('');
          change(setActorId)(id);
        }}
        onFilterEntity={(type, id) => {
          setOpen(null);
          setEntityType(type);
          change(setEntityId)(id);
        }}
      />
    </div>
  );
}

function Chip({
  label,
  title,
  onRemove,
}: {
  label: string;
  title: string;
  onRemove: () => void;
}) {
  const t = useCopy().adminAuditLog;
  return (
    <span
      title={title}
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary-line bg-primary-soft pr-1 pl-2.5 text-[11px] font-semibold text-primary"
    >
      <span className="font-mono">{label}</span>
      <button
        type="button"
        aria-label={t.clearFilters + ': ' + label}
        onClick={onRemove}
        className="inline-flex size-6 items-center justify-center rounded-md hover:bg-primary/10"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  );
}

function ExportButton({
  filters,
  disabled,
}: {
  filters: Omit<AuditLogQuery, 'page'>;
  disabled: boolean;
}) {
  const copy = useCopy();
  const t = copy.adminAuditLog;
  const locale = useLocale();
  const { show } = useToast();
  const exporting = useExportAuditLog();

  async function save() {
    const result = await exporting.run(filters);
    if (result.status === 'error') {
      show({ tone: 'error', message: errorText(copy, result.error) });
      return;
    }
    if (result.status !== 'success') return;
    // The server names the file the same way in its Content-Disposition.
    const name =
      'cryptopilot-audit-log' +
      (filters.from ? '-' + filters.from : '') +
      (filters.to ? '-' + filters.to : '') +
      '.csv';
    // A byte order mark, so a spreadsheet reads the Vietnamese names as UTF-8.
    const url = URL.createObjectURL(
      new Blob(['﻿' + result.data.csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    const { truncated, matched } = result.data;
    show(
      truncated
        ? {
            tone: 'info',
            message:
              matched === null
                ? t.exportCutUnknown
                : formatCopy(t.exportCut, {
                    n: matched.toLocaleString(locale),
                  }),
          }
        : { tone: 'success', message: t.exportDone },
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={disabled || exporting.pending}
      title={t.exportLimit}
      onClick={() => void save()}
    >
      <Download size={13} aria-hidden="true" />
      {t.exportCsv}
    </Button>
  );
}

const CATEGORIES: readonly ('' | SystemEventCategory)[] = [
  '',
  'SYSTEM_ERROR',
  'EXTERNAL_API_FAILURE',
];

function SystemLog() {
  const copy = useCopy();
  const t = copy.adminAuditLog;
  const [category, setCategory] = useState<'' | SystemEventCategory>('');
  const [source, setSource] = useState<'' | SystemEventSource>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<SystemEvent | null>(null);
  const backwards = Boolean(from && to && from > to);
  const filtered = Boolean(category || source || from || to);
  const events = useSystemEvents({
    page,
    ...(category ? { category } : {}),
    ...(source ? { source } : {}),
    ...(from && !backwards ? { from } : {}),
    ...(to && !backwards ? { to } : {}),
  });
  const total = events.data?.total ?? 0;
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  return (
    <div>
      <div className="mb-3 rounded-xl border border-line bg-surface p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_repeat(2,9.5rem)]">
          <Select
            label={t.sourceLabel}
            value={source}
            onChange={(event) =>
              change(setSource)(event.target.value as '' | SystemEventSource)
            }
          >
            <option value="">{t.any}</option>
            {SYSTEM_EVENT_SOURCES.map((value) => (
              <option key={value} value={value}>
                {t[`source${value}`]}
              </option>
            ))}
          </Select>
          <Input
            label={t.fromLabel}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => change(setFrom)(event.target.value)}
          />
          <Input
            label={t.toLabel}
            type="date"
            value={to}
            min={from || undefined}
            error={backwards ? t.periodBackwards : undefined}
            onChange={(event) => change(setTo)(event.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<'' | SystemEventCategory>
              label={t.categoryLabel}
              value={category}
              onChange={change(setCategory)}
              options={CATEGORIES.map((value) => ({
                value,
                label: value ? t[`category${value}`] : t.categoryAll,
              }))}
            />
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategory('');
                  setSource('');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
              >
                {t.clearFilters}
              </Button>
            )}
          </div>
          {events.data && (
            <span className="text-xs text-muted-dim">
              {total === 1
                ? t.eventsTotalOne
                : formatCopy(t.eventsTotal, { n: total })}
            </span>
          )}
        </div>
      </div>
      {events.isPending ? (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-14 w-full" />
          ))}
        </div>
      ) : events.isError ? (
        <ErrorState
          message={errorText(copy, events.error)}
          onRetry={() => void events.refetch()}
        />
      ) : (
        <div
          className={
            events.isPlaceholderData
              ? 'opacity-60 transition-opacity'
              : undefined
          }
        >
          <SystemEventTable
            events={events.data.items}
            emptyMessage={filtered ? t.eventsEmptyFiltered : t.eventsEmpty}
            onOpen={setOpen}
          />
          <Pagination
            page={page}
            total={total}
            pageSize={events.data.pageSize || 20}
            onChange={setPage}
            disabled={events.isFetching}
          />
        </div>
      )}
      <SystemEventDialog event={open} onClose={() => setOpen(null)} />
    </div>
  );
}
