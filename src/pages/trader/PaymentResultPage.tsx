import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { buttonClassName } from '../../components/ui/button-styles';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { vnd } from '../../features/subscription/components/billing-format';
import {
  BILLING_KEY,
  POLL_LIMIT_MS,
  useCurrentSubscription,
  useOrder,
} from '../../features/subscription/hooks/use-billing';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText } from '../../i18n/messages';
import { formatInstantLocal } from '../../utils/instant-format';

/**
 * SCR-31 Payment result (UC-38, BR-53): the gateway sends the browser here
 * with `?orderCode=`, which proves nothing. The page reads the order every
 * 5 s for up to 2 minutes and shows only what the backend reports after the
 * gateway's IPN: paid, failed, expired, or still waiting. SePay comes back
 * with `&result=cancelled` when the Trader cancelled its page and
 * `&result=error` when it failed: the page then reads the order once and,
 * unless it is already paid, says so at once instead of waiting.
 */
export function PaymentResultPage() {
  const copy = useCopy();
  const b = copy.billing;
  const [params] = useSearchParams();
  const code = params.get('orderCode');
  const [round, setRound] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const result = params.get('result');
  const left =
    result === 'cancelled' ? 'cancelled' : result === 'error' ? 'error' : null;
  const order = useOrder(code, !timedOut && left === null);
  const client = useQueryClient();
  const status = order.data?.status;
  const paid = status === 'PAID';
  const current = useCurrentSubscription();

  // Each round asks for at most POLL_LIMIT_MS; "check again" starts another.
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), POLL_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [round]);

  useEffect(() => {
    if (paid)
      void client.invalidateQueries({ queryKey: [...BILLING_KEY, 'current'] });
    if (status && status !== 'PENDING')
      void client.invalidateQueries({ queryKey: [...BILLING_KEY, 'orders'] });
  }, [paid, status, client]);

  const header = (
    <PageHeader
      title={b.resultTitle}
      {...(code ? { description: formatCopy(b.resultOrder, { code }) } : {})}
    />
  );
  if (!code)
    return (
      <div className="mx-auto w-full max-w-xl">
        {header}
        <ErrorState message={b.resultMissing} />
      </div>
    );

  let content;
  if (order.isPending) content = <Skeleton className="h-40 w-full" />;
  else if (order.isError)
    content = (
      <ErrorState
        message={errorText(copy, order.error)}
        onRetry={() => void order.refetch()}
      />
    );
  else {
    const o = order.data;
    // The gateway's word only explains an order it has not settled as paid.
    const leftUnpaid =
      left !== null && (o.status === 'PENDING' || o.status === 'EXPIRED');
    const view =
      o.status === 'PAID'
        ? {
            icon: (
              <CheckCircle2
                className="text-positive"
                size={40}
                aria-hidden="true"
              />
            ),
            title: b.resultPaidTitle,
            body: current.data?.endAt
              ? formatCopy(b.resultPaidBody, {
                  plan: o.packageName,
                  end: formatInstantLocal(current.data.endAt),
                })
              : null,
          }
        : leftUnpaid && left === 'cancelled'
          ? {
              icon: (
                <XCircle className="text-muted" size={40} aria-hidden="true" />
              ),
              title: b.resultCancelledTitle,
              body: b.resultCancelledBody,
            }
          : o.status === 'FAILED' || leftUnpaid
            ? {
                icon: (
                  <XCircle
                    className="text-negative"
                    size={40}
                    aria-hidden="true"
                  />
                ),
                title: b.resultFailedTitle,
                body: b.resultFailedBody,
              }
            : o.status === 'EXPIRED'
              ? {
                  icon: (
                    <XCircle
                      className="text-muted"
                      size={40}
                      aria-hidden="true"
                    />
                  ),
                  title: b.resultExpiredTitle,
                  body: b.resultExpiredBody,
                }
              : {
                  icon: (
                    <Clock
                      className="text-warning"
                      size={40}
                      aria-hidden="true"
                    />
                  ),
                  title: timedOut ? b.resultSlowTitle : b.resultPendingTitle,
                  body: timedOut ? b.resultSlowBody : b.resultPendingBody,
                };
    content = (
      <Card
        padding="lg"
        className="flex flex-col items-center gap-3 text-center"
      >
        {view.icon}
        <h2 className="text-xl font-semibold text-fg" role="status">
          {view.title}
        </h2>
        {view.body && <p className="max-w-md text-sm text-fg-2">{view.body}</p>}
        <p className="font-mono text-sm text-muted">
          {o.packageName} · {vnd(o.amount)}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {o.status === 'PENDING' && timedOut && !leftUnpaid && (
            <Button
              onClick={() => {
                setTimedOut(false);
                setRound((r) => r + 1);
                void order.refetch();
              }}
            >
              {b.checkAgain}
            </Button>
          )}
          <Link
            to="/subscription"
            className={buttonClassName(
              o.status === 'PAID' || leftUnpaid ? 'primary' : 'secondary',
              'md',
            )}
          >
            {b.backToPlans}
          </Link>
          <Link
            to="/subscription/payments"
            className={buttonClassName('secondary', 'md')}
          >
            {b.viewHistory}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {header}
      {content}
    </div>
  );
}
