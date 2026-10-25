import type { ReactNode } from 'react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { messageText } from '../../../i18n/messages';
import type { EntryDeviation } from '../../../types/domain';
import { planPrice, planQuantity, planRatio } from './plan-format';

/**
 * MSG51 (TP-C): the MARKET entry moved 0.25 R or more from the plan, within
 * the limit. Nothing was saved or activated. The dialog shows the
 * recalculated plan from the refusal itself (no second call) and the MSG51
 * sentence with the server's `messageArgs` in order (deviation and R:R
 * rounded to 2 decimals). "Activate anyway" repeats the same request with
 * the confirmation; "Back" leaves the plan as it is. The confirm button is
 * disabled while the request runs, so it is never sent twice.
 */
export function DeviationConfirmDialog({
  deviation,
  messageArgs,
  pending,
  onConfirm,
  onBack,
}: {
  /** Null closes the dialog. */
  deviation: EntryDeviation | null;
  messageArgs: readonly string[];
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const [rawDeviation = '', quantity = '', rr = ''] = messageArgs;
  const rows: [string, string | null][] = deviation
    ? [
        [p.deviationMoved, planRatio(deviation.deviationR) + ' R'],
        [p.deviationLimit, planRatio(deviation.maxDeviationR) + ' R'],
        [p.expectedFill, planPrice(deviation.expectedFillPrice)],
        [
          p.deviationQuantity,
          deviation.positionQuantity
            ? planQuantity(deviation.positionQuantity)
            : null,
        ],
        [
          p.riskReward,
          deviation.riskRewardRatio
            ? planRatio(deviation.riskRewardRatio)
            : null,
        ],
        [
          p.netRiskReward,
          deviation.netRiskReward ? planRatio(deviation.netRiskReward) : null,
        ],
      ]
    : [];
  return (
    <Dialog
      open={deviation !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onBack();
      }}
      title={p.deviationTitle}
      description={messageText(copy, 'MSG51', [
        rawDeviation && planRatio(rawDeviation),
        quantity && planQuantity(quantity),
        rr && planRatio(rr),
      ])}
      accent="warning"
      footer={
        <>
          <Button variant="secondary" onClick={onBack} disabled={pending}>
            {p.deviationBack}
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {p.deviationConfirm}
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-1 gap-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5"
          >
            <dt className="text-[11px] text-muted-dim">{label}</dt>
            <dd className="text-right text-xs text-fg">
              {value === null ? (
                copy.market.noValue
              ) : (
                <NumericText value={value} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

/**
 * MSG52 (TP-C): the MARKET entry moved beyond the limit, or the expected
 * fill is at or past the take profit. A refusal, not a question: the plan
 * stays a DRAFT and no retry is offered; `takeProfitReached` says which
 * half of the sentence applies.
 */
export function DeviationRefusal({
  deviation,
  messageArgs,
  children,
}: {
  deviation: EntryDeviation;
  messageArgs: readonly string[];
  /** What the Trader can do instead (Edit, Cancel, Save as draft). */
  children?: ReactNode;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const [rawDeviation = '', max = ''] = messageArgs;
  return (
    <Alert
      tone="danger"
      title={messageText(copy, 'MSG52', [
        rawDeviation && planRatio(rawDeviation),
        max && planRatio(max),
      ])}
      className="mt-3 w-full"
    >
      <p>
        {deviation.takeProfitReached
          ? p.deviationPastTakeProfit
          : p.deviationBeyondLimit}
      </p>
      {children}
    </Alert>
  );
}
