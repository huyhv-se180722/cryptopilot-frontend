import { useState, type FormEvent } from 'react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type {
  PlanPosition,
  PlanWarning,
  TradingPlan,
} from '../../../types/domain';
import { compareDecimal, trimDecimal } from '../../../utils/decimal-format';
import { formatInstantLocal } from '../../../utils/instant-format';
import { usePositionLevels } from '../hooks/use-plans';
import { SeverityBadge } from './PlanBadges';
import { breakevenReachable } from './plan-format';
import { drawablePrice } from './plan-form';

type LevelField = 'stopLoss' | 'takeProfit';

/**
 * TP-E "Edit SL/TP" of an OPEN position (SCR-18, D-124): the current stop
 * loss and take profit to change, and "Move SL to breakeven", which uses
 * the server's breakeven stop (fees, slippage and funding covered), never
 * the bare entry price. The server checks the levels against the current
 * last price (MSG16 on the field, MSG15 on a bad value). Saved, it tells
 * from when the new levels act; a widened stop that breaks a risk limit is
 * saved with its warnings, shown before closing (Q-79).
 */
export function PositionLevelsDialog({
  plan,
  open,
  onClose,
}: {
  plan: TradingPlan;
  open: boolean;
  onClose: () => void;
}) {
  const p = useCopy().plan;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={p.levelsTitle}
      description={p.levelsHint}
      size="sm"
    >
      {open && plan.position && (
        <LevelsForm plan={plan} position={plan.position} onClose={onClose} />
      )}
    </Dialog>
  );
}

function LevelsForm({
  plan,
  position,
  onClose,
}: {
  plan: TradingPlan;
  position: PlanPosition;
  onClose: () => void;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const { show } = useToast();
  const save = usePositionLevels(plan.id);
  const current = {
    stopLoss: position.stopLoss ?? plan.stopLoss,
    takeProfit: position.takeProfit ?? plan.takeProfit,
  };
  const [values, setValues] = useState({
    stopLoss: trimDecimal(current.stopLoss, 0),
    takeProfit: trimDecimal(current.takeProfit, 0),
  });
  const [checked, setChecked] = useState(false);
  const [warnings, setWarnings] = useState<readonly PlanWarning[] | null>(null);
  const labels: Record<LevelField, string> = {
    stopLoss: p.positionStopLoss,
    takeProfit: p.positionTakeProfit,
  };
  // Only a changed level is sent; equal to the current one it changes nothing.
  const changed = (field: LevelField) => {
    const value = drawablePrice(values[field]);
    return value !== null && compareDecimal(value, current[field]) !== 0
      ? value
      : null;
  };
  const clientError = (field: LevelField) =>
    values[field].trim() === ''
      ? fieldErrorText(copy, 'MSG01', labels[field])
      : drawablePrice(values[field]) === null
        ? formatCopy(p.errPositive, { field: labels[field] })
        : undefined;
  const problem = problemOf(
    save.state.status === 'error' ? save.state.error : null,
  );
  const serverError = (field: LevelField) => {
    const id = problem?.fieldErrors[field];
    if (!id) return undefined;
    if (id === 'MSG16')
      return messageText(copy, 'MSG16', [], {
        direction: p[`directionName${plan.direction}`],
        rule:
          plan.market === 'futures' && field === 'stopLoss'
            ? p[`ruleOpenLevelsFutures${plan.direction}`]
            : p[`ruleOpenLevels${plan.direction}`],
      });
    if (id === 'MSG15')
      return formatCopy(p.errPositive, { field: labels[field] });
    return fieldErrorText(copy, id, labels[field]);
  };
  const errorOf = (field: LevelField) =>
    (checked ? clientError(field) : undefined) ?? serverError(field);
  const notice =
    save.state.status !== 'error'
      ? null
      : problem?.status === 409
        ? p.levelsNotOpen
        : problem?.code === 'MARKET_PRICE_UNAVAILABLE' ||
            problem?.status === 503
          ? p.priceUnavailable
          : problem && Object.keys(problem.fieldErrors).length > 0
            ? null
            : errorText(copy, save.state.error);

  const done = (saved: TradingPlan) => {
    const from = saved.position?.levelsEffectiveFrom;
    show({
      tone: 'success',
      message: from
        ? formatCopy(p.levelsSavedFrom, { time: formatInstantLocal(from) })
        : p.levelsSaved,
    });
  };

  async function submit(stopLoss: string | null, takeProfit: string | null) {
    if (stopLoss === null && takeProfit === null) {
      onClose();
      return;
    }
    const result = await save.run({ stopLoss, takeProfit });
    if (result.status !== 'success') return;
    done(result.data);
    const shown = result.data.position?.levelWarnings ?? [];
    if (shown.length > 0) setWarnings(shown);
    else onClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setChecked(true);
    if (clientError('stopLoss') || clientError('takeProfit')) return;
    void submit(changed('stopLoss'), changed('takeProfit'));
  }

  if (warnings)
    return (
      <div className="grid gap-3">
        <p className="text-xs text-fg-2">{p.levelsWarned}</p>
        <ul className="grid gap-2">
          {warnings.map((warning) => (
            <li
              key={warning.type}
              className="flex items-start gap-2 text-xs text-fg"
            >
              <SeverityBadge severity={warning.severity} />
              {p[`warning${warning.type}`]}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button onClick={onClose}>{p.levelsDone}</Button>
        </div>
      </div>
    );

  const reachable = breakevenReachable(plan, position);
  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      {notice && <Alert tone="danger" title={notice} />}
      <Input
        label={labels.stopLoss}
        inputMode="decimal"
        autoComplete="off"
        value={values.stopLoss}
        onChange={(event) =>
          setValues((v) => ({ ...v, stopLoss: event.target.value }))
        }
        error={errorOf('stopLoss')}
      />
      <Input
        label={labels.takeProfit}
        inputMode="decimal"
        autoComplete="off"
        value={values.takeProfit}
        onChange={(event) =>
          setValues((v) => ({ ...v, takeProfit: event.target.value }))
        }
        error={errorOf('takeProfit')}
      />
      {position.breakevenPrice && (
        <div className="rounded-lg border border-line bg-page-alt p-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!reachable || save.pending}
            title={p.breakevenTooltip}
            onClick={() => void submit(position.breakevenPrice, null)}
          >
            {p.breakevenMove}
          </Button>
          <p className="mt-2 text-[11px] text-muted-dim">
            {reachable
              ? formatCopy(p.breakevenAt, {
                  price: trimDecimal(position.breakevenPrice, 2),
                })
              : p.breakevenNotYet}
            {position.breakevenProvisional && ` (${p.provisional})`}
          </p>
        </div>
      )}
      <p className="text-[11px] text-muted-dim">{p.levelsNextCandle}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {copy.common.cancel}
        </Button>
        <Button type="submit" disabled={save.pending}>
          {p.levelsSave}
        </Button>
      </div>
    </form>
  );
}
