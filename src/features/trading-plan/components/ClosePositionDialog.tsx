import { useState, type ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { Alert } from '../../../components/feedback/States';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { NumericText } from '../../../components/ui/NumericText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import type { TradingPlan } from '../../../types/domain';
import { formatClockUtc7 } from '../../../utils/instant-format';
import {
  useCloseEstimate,
  useClosePosition,
} from '../hooks/use-close-position';
import { Pnl } from './PlanDetailPanels';
import { planAmount, planPnl, planPrice } from './plan-format';

/**
 * Close position on SCR-18 and its SCR-19 dialog (UC-21, T-047), on the
 * contract of 2026-10-25 (T-046): the estimate of closing now — exit price
 * after slippage, price result, entry fee, exit fee, funding so far
 * (Futures; "provisional" when flagged) and the estimated net, signed in
 * green or red — read again every 5 s with its time. Confirm closes at the
 * current price, then shows the result (MSG21 asked "at about {price}") and
 * the plan reloads. When the engine closed the position first (409 MSG43)
 * the dialog says so and the plan is read again; without a current price
 * (503 MSG43) Confirm stays disabled.
 */
export function ClosePosition({ plan }: { plan: TradingPlan }) {
  const p = useCopy().plan;
  const [open, setOpen] = useState(false);
  // The dialog stays while the plan reloads as CLOSED (a race, MSG43);
  // only the button needs an OPEN position.
  return (
    <>
      {plan.position?.status === 'OPEN' && (
        <Button variant="danger" onClick={() => setOpen(true)}>
          <LogOut size={14} aria-hidden="true" />
          {p.closePosition}
        </Button>
      )}
      {open && (
        <ClosePositionDialog plan={plan} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ClosePositionDialog({
  plan,
  onClose,
}: {
  plan: TradingPlan;
  onClose: () => void;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const { show } = useToast();
  const closing = useClosePosition(plan.id);
  // Stop reading the estimate once the position is no longer OPEN.
  const settled = closing.state.status === 'success' || closing.raced;
  const estimate = useCloseEstimate(plan.id, !settled);
  const data = estimate.data;
  const raced = closing.raced || estimate.closed;

  async function confirm() {
    const result = await closing.close();
    if (result?.status !== 'success') return;
    const position = result.data.position;
    show({
      tone: 'success',
      message:
        position?.exitPrice && position.netPnl
          ? formatCopy(p.closedResult, {
              price: planPrice(position.exitPrice),
              pnl: planPnl(position.netPnl),
            })
          : p.closedPlain,
    });
    onClose();
  }

  const rows: [string, ReactNode][] = data
    ? [
        [
          p.closeEstimatedExit,
          <NumericText value={planPrice(data.estimatedExitPrice)} />,
        ],
        [p.closePriceResult, <Pnl value={data.priceResult} />],
        [p.closeEntryFee, <NumericText value={planAmount(data.entryFee)} />],
        [
          p.closeExitFee,
          <NumericText value={planAmount(data.estimatedExitFee)} />,
        ],
        ...(data.fundingSoFar !== null
          ? ([
              [
                p.closeFunding,
                <span className="inline-flex items-center gap-1.5">
                  {data.fundingProvisional && (
                    <Badge tone="warning">{p.provisional}</Badge>
                  )}
                  <Pnl value={data.fundingSoFar} />
                </span>,
              ],
            ] as [string, ReactNode][])
          : []),
      ]
    : [];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !closing.pending) onClose();
      }}
      title={p.closeTitle}
      {...(data && !raced
        ? {
            description: messageText(copy, 'MSG21', [], {
              price: planPrice(data.estimatedExitPrice),
              pnl: planPnl(data.estimatedNetPnl),
            }),
          }
        : {})}
      accent="negative"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={closing.pending}
          >
            {raced ? p.closeBack : p.closeKeep}
          </Button>
          {!raced && (
            <Button
              variant="danger"
              onClick={() => void confirm()}
              disabled={closing.pending || !data || estimate.unavailable}
            >
              {p.closeConfirm}
            </Button>
          )}
        </>
      }
    >
      {raced ? (
        <Alert tone="info" title={p.closeAlready} />
      ) : (
        <div aria-live="polite">
          {estimate.unavailable && (
            <Alert tone="warning" title={p.closeUnavailable} className="mb-3" />
          )}
          {!data && estimate.isFetching && <Skeleton className="h-32 w-full" />}
          {data && (
            <>
              <dl className="grid grid-cols-1 gap-y-2">
                {rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5"
                  >
                    <dt className="text-[11px] text-muted-dim">{label}</dt>
                    <dd className="text-right text-xs text-fg">{value}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 pt-1">
                  <dt className="text-xs font-medium text-fg-2">
                    {p.closeNet}
                  </dt>
                  <dd className="text-right text-sm font-semibold">
                    <Pnl value={data.estimatedNetPnl} />
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[10px] text-muted-dim">
                <time dateTime={data.at}>
                  {formatCopy(p.closeAt, { time: formatClockUtc7(data.at) })}
                </time>
              </p>
            </>
          )}
          {estimate.isError &&
            !estimate.unavailable &&
            !estimate.closed &&
            !data && (
              <Alert
                tone="danger"
                title={errorText(copy, estimate.error)}
                className="mt-3"
              />
            )}
          {closing.state.status === 'error' && !closing.raced && (
            <Alert
              tone="danger"
              title={errorText(copy, closing.state.error)}
              className="mt-3"
            />
          )}
        </div>
      )}
    </Dialog>
  );
}
