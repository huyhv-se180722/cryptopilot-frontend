import { useId, useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import { groupThousands } from '../../../utils/decimal-format';
import { formatInstantLocal } from '../../../utils/instant-format';
import { classNames } from '../../../utils/class-names';
import {
  useAdminOrder,
  useMarkOrderHandled,
  useReconcileOrder,
} from '../hooks/use-admin-orders';
import { OrderStatusBadge } from './OrderStatusBadge';

/** The backend's limit of a handling note. */
const NOTE_MAX = 1000;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <dt className="text-[11px] text-muted-dim">{label}</dt>
      <dd className="m-0 text-right font-mono text-xs break-all text-fg-2">
        {children}
      </dd>
    </div>
  );
}

/** The gateway's JSON shown indented when it parses, as sent otherwise. */
function payloadText(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

/**
 * One order of SCR-40: what the gateway answered, the subscription it
 * opened, reconciliation of a PENDING order (NSF-13) and the handling
 * note of an order flagged for manual handling (BR-63); both audited.
 */
export function OrderDetailDialog({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const copy = useCopy();
  const t = copy.adminOrders;
  const none = copy.market.noValue;
  const { show } = useToast();
  const query = useAdminOrder(code);
  const reconcile = useReconcileOrder();
  const handle = useMarkOrderHandled();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const noteId = useId();
  const detail = query.data;
  const order = detail?.order;
  const time = (value: string | null) =>
    value === null ? none : formatInstantLocal(value);
  const busy = reconcile.isPending || handle.isPending;
  const awaiting = order?.manualHandling === true && order.handledAt === null;

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={formatCopy(t.detailTitle, { code })}
    >
      {query.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : query.isError || !detail || !order ? (
        <p role="alert" className="text-xs text-negative">
          {errorText(copy, query.error)}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="m-0">
            <Row label={t.columnStatus}>
              <OrderStatusBadge status={order.status} />
            </Row>
            <Row label={t.columnPackage}>
              {order.packageName} ({order.tier})
            </Row>
            <Row label={t.columnType}>{t[`type${order.orderType}`]}</Row>
            <Row label={t.columnAmount}>
              {groupThousands(order.amount)} {order.currency}
            </Row>
            <Row label={t.columnGateway}>{order.gateway}</Row>
            <Row label={t.user}>{order.userId}</Row>
            <Row label={t.columnCreated}>{time(order.createdAt)}</Row>
            <Row label={t.expiresAt}>{time(order.expiresAt)}</Row>
            <Row label={t.paidAt}>{time(order.paidAt)}</Row>
            <Row label={t.transactionNo}>
              {detail.gatewayTransactionNo ?? none}
            </Row>
            <Row label={t.responseCode}>
              {detail.gatewayResponseCode ?? none}
            </Row>
            <Row label={t.ipnReceivedAt}>{time(detail.ipnReceivedAt)}</Row>
            <Row label={t.subscription}>
              {detail.subscription
                ? formatCopy(t.subscriptionValue, {
                    status: t[`subscription${detail.subscription.status}`],
                    start: time(detail.subscription.startAt),
                    end: time(detail.subscription.endAt),
                  })
                : t.subscriptionNone}
            </Row>
            {order.manualHandling && (
              <Row label={t.handling}>
                {order.handledAt
                  ? formatCopy(t.handledOn, { time: time(order.handledAt) })
                  : t.awaitingHandling}
              </Row>
            )}
          </dl>
          {detail.handlingNote && (
            <div>
              <h3 className={fieldLabelClass}>{t.handlingNote}</h3>
              <p className="m-0 text-xs whitespace-pre-line text-fg-2">
                {detail.handlingNote}
              </p>
            </div>
          )}
          {detail.gatewayPayload && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-fg-2">
                {t.payload}
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-raised p-3 font-mono text-[11px] text-fg-2">
                {payloadText(detail.gatewayPayload)}
              </pre>
            </details>
          )}
          {(reconcile.isError || handle.isError) && (
            <p role="alert" className="m-0 text-xs text-negative">
              {errorText(copy, reconcile.error ?? handle.error)}
            </p>
          )}
          {order.status === 'PENDING' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
              <p className="m-0 text-xs text-muted-dim">{t.reconcileHint}</p>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  reconcile.mutate(code, {
                    onSuccess: () =>
                      show({ tone: 'success', message: t.reconciled }),
                  })
                }
              >
                {reconcile.isPending ? t.reconciling : t.reconcile}
              </Button>
            </div>
          )}
          {awaiting && (
            <form
              noValidate
              className="flex flex-col gap-2 rounded-lg border border-warning-line bg-warning-soft p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const text = note.trim();
                if (!text) {
                  setNoteError(
                    messageText(copy, 'MSG01', [], {
                      field: t.handlingNote.toLowerCase(),
                    }),
                  );
                  return;
                }
                handle.mutate(
                  { code, note: text },
                  {
                    onSuccess: () => {
                      setNote('');
                      show({
                        tone: 'success',
                        message: messageText(copy, 'MSG14'),
                      });
                    },
                  },
                );
              }}
            >
              <label htmlFor={noteId} className={fieldLabelClass}>
                {t.handlingNote}
              </label>
              <textarea
                id={noteId}
                rows={3}
                maxLength={NOTE_MAX}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setNoteError(null);
                }}
                aria-invalid={noteError ? true : undefined}
                placeholder={t.handlingPlaceholder}
                className={classNames(fieldControlClass, 'resize-y text-xs')}
              />
              {noteError && (
                <span role="alert" className={fieldErrorClass}>
                  {noteError}
                </span>
              )}
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={busy}>
                  {handle.isPending ? t.saving : t.markHandled}
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Dialog>
  );
}
