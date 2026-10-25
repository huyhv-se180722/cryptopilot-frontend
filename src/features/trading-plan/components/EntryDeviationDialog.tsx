import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { NumericText } from '../../../components/ui/NumericText';
import { useCopy } from '../../../hooks/use-copy';
import { messageText } from '../../../i18n/messages';
import type { EntryDeviation } from '../../../types/domain';
import { planPrice, planQuantity, planRatio } from './plan-format';

type Confirm = Extract<EntryDeviation, { kind: 'confirm' }>;

/**
 * T-113 (BR-69, TP-C): the MARKET entry moved since the plan was saved, by
 * up to the plan's limit. MSG51 with the re-sized quantity and R:R; the
 * risk stays the planned one. Activate anyway repeats the same request with
 * the confirmation; Keep as draft changes nothing.
 */
export function EntryDeviationDialog({
  deviation,
  pending,
  onConfirm,
  onClose,
}: {
  /** null = closed. */
  deviation: Confirm | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const copy = useCopy();
  const p = copy.plan;
  return (
    <Dialog
      open={deviation !== null}
      onOpenChange={(open) => !open && onClose()}
      title={p.deviationTitle}
      size="sm"
      accent="warning"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {p.deviationKeep}
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            {p.deviationActivate}
          </Button>
        </>
      }
    >
      {deviation && (
        <div className="grid gap-3">
          <p className="text-sm text-fg">
            {messageText(copy, 'MSG51', [], {
              deviation: planRatio(deviation.deviationR),
              quantity: planQuantity(deviation.positionQuantity),
              rr: planRatio(deviation.riskRewardRatio),
            })}
          </p>
          <dl className="grid gap-1.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-dim">{p.expectedFill}</dt>
              <dd>
                <NumericText value={planPrice(deviation.expectedFillPrice)} />
              </dd>
            </div>
            {deviation.netRiskReward && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-dim">{p.netRiskReward}</dt>
                <dd>
                  <NumericText value={planRatio(deviation.netRiskReward)} />
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted-dim">{p.deviationLimit}</dt>
              <dd>
                <NumericText
                  value={planRatio(deviation.maxDeviationR)}
                  suffix=" R"
                />
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-dim">{p.deviationRiskKept}</p>
        </div>
      )}
    </Dialog>
  );
}
