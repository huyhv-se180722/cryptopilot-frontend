import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, ErrorState } from '../../../components/feedback/States';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Skeleton } from '../../../components/ui/Skeleton';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, fieldErrorText } from '../../../i18n/messages';
import {
  HANDLING_NOTE_MAX,
  type AdminOrderDetail,
} from '../../../services/api/admin-orders';
import { problemOf } from '../../../services/api/errors';
import { classNames } from '../../../utils/class-names';
import { formatInstantLocal } from '../../../utils/instant-format';
import { statusTone, vnd } from '../../subscription/components/billing-format';
import {
  useAdminOrder,
  useMarkOrderHandled,
  useReconcileOrder,
} from '../hooks/use-admin-orders';
import { userPath } from './account-format';
import { canReconcile, prettyPayload } from './order-format';

/**
 * One subscription order on SCR-40 (UC-48): the order, what its gateway
 * last answered, the subscription it opened, and the two audited actions:
 * asking the gateway again, and recording how a flagged order was handled.
 */
export function OrderDetailDialog({
  orderCode,
  onClose,
}: {
  /** null = closed. */
  orderCode: string | null;
  onClose: () => void;
}) {
  const t = useCopy().adminPayments;
  return (
    <Dialog
      open={orderCode !== null}
      onOpenChange={(open) => !open && onClose()}
      title={formatCopy(t.detailTitle, { code: orderCode ?? '' })}
      size="lg"
    >
      {orderCode && <Detail key={orderCode} orderCode={orderCode} />}
    </Dialog>
  );
}

function Detail({ orderCode }: { orderCode: string }) {
  const copy = useCopy();
  const detail = useAdminOrder(orderCode);
  if (detail.isPending) return <Skeleton className="h-72 w-full" />;
  if (detail.isError)
    return (
      <ErrorState
        message={errorText(copy, detail.error)}
        onRetry={() => void detail.refetch()}
      />
    );
  return <Loaded detail={detail.data} />;
}

function Loaded({ detail }: { detail: AdminOrderDetail }) {
  const copy = useCopy();
  const t = copy.adminPayments;
  const b = copy.billing;
  const { order, subscription } = detail;
  const payload = prettyPayload(detail.gatewayPayload);
  const waiting = order.manualHandling && order.handledAt === null;
  return (
    <div className="grid max-h-[70vh] gap-5 overflow-y-auto pr-1">
      <Section title={t.sectionOrder}>
        <Field label={b.colStatus}>
          <Badge tone={statusTone[order.status]}>
            {b[`status${order.status}`]}
          </Badge>
        </Field>
        <Field label={b.colPackage}>
          {order.packageName}{' '}
          <span className="text-muted-dim">({order.tier})</span>
        </Field>
        <Field label={b.colType}>{b[`type${order.orderType}`]}</Field>
        <Field label={b.colAmount}>{vnd(order.amount)}</Field>
        <Field label={b.colGateway}>{order.gateway}</Field>
        <Field label={t.trader}>
          <Link
            to={userPath(order.userId)}
            className="text-primary hover:underline"
          >
            {t.openTrader}
          </Link>
        </Field>
        <Field label={b.colCreated}>
          {formatInstantLocal(order.createdAt)}
        </Field>
        <Field label={t.expiresAt}>{formatInstantLocal(order.expiresAt)}</Field>
        <Field label={b.colPaid}>
          {order.paidAt ? formatInstantLocal(order.paidAt) : '—'}
        </Field>
      </Section>

      <Section title={t.sectionGateway}>
        {detail.ipnReceivedAt === null &&
        detail.gatewayResponseCode === null &&
        detail.gatewayTransactionNo === null ? (
          <p className="col-span-full text-xs text-muted">{t.noAnswer}</p>
        ) : (
          <>
            <Field label={t.transactionNo}>
              <span className="font-mono">
                {detail.gatewayTransactionNo ?? '—'}
              </span>
            </Field>
            <Field label={t.responseCode}>
              <span className="font-mono">
                {detail.gatewayResponseCode ?? '—'}
              </span>
            </Field>
            <Field label={t.ipnAt}>
              {detail.ipnReceivedAt
                ? formatInstantLocal(detail.ipnReceivedAt)
                : '—'}
            </Field>
          </>
        )}
        {payload && (
          <div className="col-span-full">
            <div className="mb-1 text-xs text-muted-dim">{t.payload}</div>
            <pre className="max-h-48 overflow-auto rounded-lg border border-line bg-raised p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-2">
              {payload}
            </pre>
          </div>
        )}
        {canReconcile(order.status) && (
          <Reconcile orderCode={order.orderCode} />
        )}
      </Section>

      <Section title={t.sectionSubscription}>
        {subscription === null ? (
          <p className="col-span-full text-xs text-muted">{t.noSubscription}</p>
        ) : (
          <>
            <Field label={t.subscriptionStatus}>
              {t[`sub${subscription.status}`]}
            </Field>
            <Field label={t.subscriptionPeriod}>
              {formatInstantLocal(subscription.startAt)} →{' '}
              {formatInstantLocal(subscription.endAt)}
            </Field>
            <Field label={t.carriedValue}>
              {vnd(subscription.carriedValueVnd)}
            </Field>
            <Field label={t.bonusDays}>{subscription.bonusDays}</Field>
          </>
        )}
      </Section>

      {order.manualHandling && (
        <Section title={t.sectionHandling}>
          {waiting ? (
            <div className="col-span-full grid gap-3">
              <Alert tone="warning" title={t.flagWaiting}>
                {t.flaggedBody}
              </Alert>
              <HandleForm orderCode={order.orderCode} />
            </div>
          ) : (
            <>
              <Field label={t.handledAt}>
                {order.handledAt ? formatInstantLocal(order.handledAt) : '—'}
              </Field>
              <Field label={t.handledBy}>
                {detail.handledBy ? (
                  <Link
                    to={userPath(detail.handledBy)}
                    className="text-primary hover:underline"
                  >
                    {t.openTrader}
                  </Link>
                ) : (
                  '—'
                )}
              </Field>
              <div className="col-span-full">
                <div className="mb-1 text-xs text-muted-dim">{t.note}</div>
                <p className="text-xs whitespace-pre-wrap text-fg-2">
                  {detail.handlingNote ?? '—'}
                </p>
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold text-muted">{title}</h3>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-dim">{label}</dt>
      <dd className="truncate text-xs text-fg">{children}</dd>
    </div>
  );
}

function Reconcile({ orderCode }: { orderCode: string }) {
  const copy = useCopy();
  const t = copy.adminPayments;
  const { show } = useToast();
  const reconcile = useReconcileOrder();
  const [notice, setNotice] = useState<string | null>(null);

  async function run() {
    setNotice(null);
    const result = await reconcile.run(orderCode);
    if (result.status === 'success') {
      show({ tone: 'success', message: t.reconciled });
      return;
    }
    if (result.status !== 'error') return;
    setNotice(
      problemOf(result.error)?.code === 'PAYMENT_GATEWAY_UNAVAILABLE'
        ? t.gatewayDown
        : errorText(copy, result.error),
    );
  }

  return (
    <div className="col-span-full grid gap-2">
      {notice && <Alert tone="danger" title={notice} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={reconcile.pending}
          onClick={() => void run()}
        >
          {t.reconcile}
        </Button>
        <span className="text-xs text-muted-dim">{t.reconcileHint}</span>
      </div>
    </div>
  );
}

function HandleForm({ orderCode }: { orderCode: string }) {
  const copy = useCopy();
  const t = copy.adminPayments;
  const { show } = useToast();
  const handled = useMarkOrderHandled();
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noteId = useId();
  const text = note.trim();
  const tooLong = text.length > HANDLING_NOTE_MAX;
  const localError =
    touched && text === '' ? t.noteRequired : tooLong ? t.noteTooLong : null;
  const error = localError ?? fieldError;

  async function submit() {
    setTouched(true);
    if (text === '' || tooLong) return;
    setNotice(null);
    setFieldError(null);
    const result = await handled.run(orderCode, text);
    if (result.status === 'success') {
      show({ tone: 'success', message: t.handledDone });
      return;
    }
    if (result.status !== 'error') return;
    const problem = problemOf(result.error);
    const onNote = problem?.fieldErrors.note;
    if (problem?.code === 'ORDER_NOT_AWAITING_HANDLING')
      setNotice(t.notAwaiting);
    else if (onNote) setFieldError(fieldErrorText(copy, onNote, t.note));
    else setNotice(errorText(copy, result.error));
  }

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {notice && <Alert tone="danger" title={notice} />}
      <div>
        <label htmlFor={noteId} className={fieldLabelClass}>
          {t.note}
        </label>
        <textarea
          id={noteId}
          rows={3}
          required
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setFieldError(null);
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteId + '-hint'}
          className={classNames(fieldControlClass, 'resize-y')}
        />
        <div
          id={noteId + '-hint'}
          className="mt-1 flex justify-between gap-2 text-xs"
        >
          <span
            className={classNames(
              error ? fieldErrorClass : fieldHintClass,
              'mt-0',
            )}
          >
            {error ?? t.noteHint}
          </span>
          <span
            className={classNames(
              'font-mono',
              tooLong ? 'text-negative' : 'text-muted-x',
            )}
          >
            {text.length}/{HANDLING_NOTE_MAX}
          </span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={handled.pending}>
          {t.markHandled}
        </Button>
      </div>
    </form>
  );
}
