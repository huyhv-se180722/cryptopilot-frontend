import type { ReactNode } from 'react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { NumericText } from '../../../components/ui/NumericText';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { TradingPlan } from '../../../types/domain';
import { withSign } from '../../../utils/decimal-sign';
import { formatInstantLocal } from '../../../utils/instant-format';
import { useCloseEstimate, useClosePosition } from '../hooks/use-plans';
import { planAmount, planPrice } from './plan-format';

/**
 * SCR-19 Close Position (UC-21, BR-39, MSG21): the estimated exit at the
 * current last price moved by the slippage, with the price result, entry
 * and exit fees, the funding so far and the estimated net P/L, read again
 * every few seconds while open. The estimate reserves nothing: the close
 * executes at the price of its own moment. A position the engine closed
 * first (409) refreshes the plan; a missing price says so.
 */
export function ClosePositionDialog({
  plan,
  open,
  onClose,
}: {
  plan: TradingPlan;
  open: boolean;
  onClose: () => void;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const { show } = useToast();
  const estimate = useCloseEstimate(plan.id, open);
  const close = useClosePosition(plan.id);
  const data = estimate.data;

  async function confirm() {
    const result = await close.run();
    if (result.status !== 'success') return;
    const net = result.data.position?.netPnl;
    show({
      tone: 'success',
      message: net
        ? formatCopy(p.closeDone, { pnl: withSign(planAmount(net)) })
        : p.closeDoneShort,
    });
    onClose();
  }

  const failure = close.state.status === 'error' ? close.state.error : null;
  const failureText = failure
    ? problemOf(failure)?.status === 409
      ? p.closeAlready
      : problemOf(failure)?.status === 503
        ? p.priceUnavailable
        : errorText(copy, failure)
    : null;
  const estimateText = estimate.isError
    ? problemOf(estimate.error)?.status === 409
      ? p.closeAlready
      : problemOf(estimate.error)?.status === 503
        ? p.priceUnavailable
        : errorText(copy, estimate.error)
    : null;

  const row = (label: string, value: ReactNode) => (
    <div key={label} className="flex justify-between gap-3">
      <dt className="text-muted-dim">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={p.closeTitle}
      size="sm"
      accent="negative"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {p.closeKeep}
          </Button>
          <Button
            variant="danger"
            disabled={!data || close.pending}
            onClick={() => void confirm()}
          >
            {p.closeConfirm}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {failureText && <Alert tone="danger" title={failureText} />}
        {estimateText ? (
          <Alert tone="danger" title={estimateText} />
        ) : !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <p className="text-sm text-fg">
              {messageText(copy, 'MSG21', [], {
                price: planPrice(data.estimatedExitPrice),
                pnl: withSign(planAmount(data.estimatedNetPnl)) + ' USDT',
              })}
            </p>
            <dl className="grid gap-1.5 text-xs">
              {row(
                p.closeCurrent,
                <NumericText value={planPrice(data.currentPrice)} />,
              )}
              {row(
                p.closeExit,
                <NumericText value={planPrice(data.estimatedExitPrice)} />,
              )}
              {row(
                p.closePriceResult,
                <NumericText value={planAmount(data.priceResult)} signed />,
              )}
              {row(
                p.positionEntryFee,
                <NumericText value={planAmount(data.entryFee)} />,
              )}
              {row(
                p.closeExitFee,
                <NumericText value={planAmount(data.estimatedExitFee)} />,
              )}
              {data.fundingSoFar !== null &&
                row(
                  p.closeFunding,
                  <span>
                    <NumericText value={planAmount(data.fundingSoFar)} signed />
                    {data.fundingProvisional && (
                      <span className="ml-1 text-[10px] text-muted-dim">
                        {p.provisional}
                      </span>
                    )}
                  </span>,
                )}
              {row(
                p.closeNet,
                <NumericText
                  value={planAmount(data.estimatedNetPnl)}
                  signed
                  className="font-semibold"
                />,
              )}
            </dl>
            <p className="text-[11px] text-muted-dim">
              {formatCopy(p.closeEstimateAt, {
                time: formatInstantLocal(data.at),
              })}
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}
