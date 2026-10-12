import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Info, Plus } from 'lucide-react';
import { Alert as Banner, ErrorState } from '../../components/feedback/States';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { useToast } from '../../hooks/use-toast';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import {
  AlertDialog,
  type AlertDialogTarget,
} from '../../features/alerts/components/AlertDialog';
import {
  AlertTable,
  type AlertRowAction,
} from '../../features/alerts/components/AlertTable';
import { conditionText } from '../../features/alerts/components/alert-format';
import {
  ALERT_PAGE_SIZE,
  refusalKind,
  useAlertActions,
  useAlertList,
} from '../../features/alerts/hooks/use-alerts';
import { useWatchlist } from '../../features/watchlist/hooks/use-watchlist';
import type { Alert, AlertStatus, AlertType } from '../../types/domain';
import { pairLabel } from '../../utils/pair-label';

const STATUSES: readonly AlertStatus[] = [
  'ACTIVE',
  'PAUSED',
  'TRIGGERED',
  'EXPIRED',
];
const statusOf = (value: string | null) =>
  STATUSES.includes(value as AlertStatus) ? (value as AlertStatus) : undefined;
const typeOf = (value: string | null): AlertType | 'all' =>
  value === 'PRICE' || value === 'INDICATOR' ? value : 'all';

/**
 * SCR-13 Alerts (SRS 3.4.3, UC-14): the Trader's alerts newest first, 20 per
 * page (CR-04), filtered by status and type (in the URL); edit (SCR-14),
 * pause, resume and delete after a confirmation. New alerts are created on
 * watched pairs. Trigger history waits for notifications (T-056); the
 * "paused by a plan change" mark waits for Q-31.
 */
export function AlertsPage() {
  const copy = useCopy();
  const a = copy.alerts;
  const { show } = useToast();
  const [params, setParams] = useSearchParams();
  const status = statusOf(params.get('status'));
  const type = typeOf(params.get('type'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const list = useAlertList({
    page,
    ...(status ? { status } : {}),
    ...(type === 'all' ? {} : { type }),
  });
  const watchlist = useWatchlist();
  const pairs = watchlist.data?.items ?? [];
  const action = useAlertActions();
  const [dialog, setDialog] = useState<AlertDialogTarget | null>(null);
  const [deleting, setDeleting] = useState<Alert | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const pages = Math.max(
    1,
    Math.ceil((list.data?.total ?? 0) / ALERT_PAGE_SIZE),
  );
  const filtered = status !== undefined || type !== 'all';

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes))
      if (value === null) next.delete(key);
      else next.set(key, value);
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  }

  async function run(kind: 'pause' | 'resume' | 'remove', alert: Alert) {
    setRefusal(null);
    const result = await action.run(kind, alert.id);
    if (result.status === 'success')
      show({
        tone: 'success',
        message:
          kind === 'pause'
            ? a.paused
            : kind === 'resume'
              ? a.resumed
              : a.deleted,
      });
    else if (result.status === 'error') setRefusal(result.error);
  }

  function onAction(kind: AlertRowAction, alert: Alert) {
    if (kind === 'edit') {
      const item = pairs.find((pair) => pair.pairId === alert.pairId);
      setDialog(item ? { mode: 'edit', alert, item } : { mode: 'edit', alert });
    } else if (kind === 'delete') setDeleting(alert);
    else void run(kind, alert);
  }

  const kind = refusal === null ? null : refusalKind(refusal);
  const body = list.isPending ? (
    <Skeleton className="h-72 w-full" />
  ) : list.isError ? (
    <ErrorState
      message={errorText(copy, list.error)}
      onRetry={() => void list.refetch()}
    />
  ) : (
    <>
      <AlertTable
        rows={list.data.items}
        emptyMessage={filtered ? a.emptyFiltered : a.empty}
        disabled={action.pending}
        onAction={onAction}
      />
      {list.data.total > ALERT_PAGE_SIZE && (
        <nav
          aria-label={formatCopy(a.pageOf, { page, pages })}
          className="mt-3 flex items-center justify-end gap-3 text-xs text-muted"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) })}
          >
            {a.previous}
          </Button>
          <span aria-live="polite">
            {formatCopy(a.pageOf, { page, pages })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => update({ page: String(page + 1) })}
          >
            {a.next}
          </Button>
        </nav>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-dim">
        <Info size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
        {a.historyPending}
      </p>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold text-fg">{a.title}</h1>
          <p className="mt-0.5 text-xs text-muted-dim">{a.subtitle}</p>
        </div>
        <Button
          onClick={() => setDialog({ mode: 'create', pairs })}
          disabled={!watchlist.data}
        >
          <Plus size={14} aria-hidden="true" />
          {a.newAlert}
        </Button>
      </header>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Select
          label={a.filterStatus}
          value={status ?? ''}
          onChange={(event) => update({ status: event.target.value || null })}
          className="w-44"
        >
          <option value="">{a.allStatuses}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {a[`status${value}`]}
            </option>
          ))}
        </Select>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-fg-2">
            {a.filterType}
          </legend>
          <SegmentedControl
            label={a.filterType}
            value={type}
            onChange={(value) =>
              update({ type: value === 'all' ? null : value })
            }
            options={[
              { value: 'all', label: a.allTypes },
              { value: 'PRICE', label: a.typePRICE },
              { value: 'INDICATOR', label: a.typeINDICATOR },
            ]}
          />
        </fieldset>
      </div>
      {refusal !== null && (
        <Banner
          tone="danger"
          title={
            kind === 'expired' ? a.resumeExpired : errorText(copy, refusal)
          }
          className="mb-4"
        >
          {kind === 'upgrade' && (
            <Link to="/subscription" className="font-medium">
              {a.upgrade}
            </Link>
          )}
        </Banner>
      )}
      {body}
      <AlertDialog target={dialog} onClose={() => setDialog(null)} />
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={a.deleteTitle}
        description={
          deleting
            ? formatCopy(a.deleteConfirm, {
                condition: conditionText(copy, deleting),
                pair: pairLabel(deleting.symbol),
              })
            : ''
        }
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {a.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={action.pending}
              onClick={() => {
                const target = deleting;
                setDeleting(null);
                if (target) void run('remove', target);
              }}
            >
              {a.delete}
            </Button>
          </>
        }
      />
    </div>
  );
}
