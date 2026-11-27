import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Play, Send, X } from 'lucide-react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { messageText } from '../../../i18n/messages';
import type { TradingPlan } from '../../../types/domain';
import { useTradingBlock } from '../../market-status/hooks/use-market-status';
import { usePlanActions } from '../hooks/use-plans';
import { EntryDeviationDialog } from './EntryDeviationDialog';
import { activationErrorText, entryDeviationOf } from './plan-errors';

/**
 * SCR-18 actions (SRS 3.5.3): Edit while DRAFT (SCR-17), Activate for a
 * DRAFT (UC-18; the server re-checks price, warnings and the plan limit;
 * MSG19 on success, MSG18 or MSG27 in a banner, a field it no longer
 * accepts in words, e.g. a STOP the price has reached), Cancel for DRAFT and
 * ACTIVE after the MSG20 confirmation (UC-19). Buttons are disabled while
 * a request runs, and nothing changes before the server answers. A MARKET
 * entry moved since the save asks to confirm (MSG51, T-113) or refuses
 * (MSG52) with the way to edit the plan at the current price.
 */
export function PlanActions({ plan }: { plan: TradingPlan }) {
  const copy = useCopy();
  const p = copy.plan;
  const { show } = useToast();
  const { activate, cancel, apply, applying, pending, error, errorCode } =
    usePlanActions(plan.id);
  const navigate = useNavigate();
  const [applyOpen, setApplyOpen] = useState(false);
  // D-159: while the plan's market is closed, a plan is neither activated
  // nor cancelled once active; drafts stay editable and cancellable.
  const closed = useTradingBlock(
    plan.market === 'spot' ? 'SPOT' : 'FUTURES',
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const deviation = entryDeviationOf(error);
  const [deviationOpen, setDeviationOpen] = useState(false);

  async function onActivate(confirmDeviation = false) {
    setDeviationOpen(false);
    if (await activate(confirmDeviation))
      show({ tone: 'success', message: messageText(copy, 'MSG19') });
    else setDeviationOpen(true);
  }

  async function onCancel() {
    setConfirming(false);
    await cancel();
  }

  async function onApply() {
    const applied = await apply();
    setApplyOpen(false);
    if (applied === null) return;
    show({
      tone: 'success',
      message:
        applied.entryStatus === 'FILLED' ? p.appliedFilled : p.appliedWaiting,
    });
    navigate(`/trade/${applied.market}/${applied.symbol}`);
  }

  const canCancel = plan.status === 'DRAFT' || plan.status === 'ACTIVE';
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {plan.editable && (
          <Link
            to={`/plans/${plan.id}/edit`}
            className={buttonClassName('secondary', 'md', 'no-underline')}
          >
            <Pencil size={14} aria-hidden="true" />
            {p.edit}
          </Link>
        )}
        {plan.status === 'DRAFT' && (
          <Button
            onClick={() => void onActivate()}
            disabled={pending || closed !== null}
            aria-describedby={
              plan.blocksActivation ? 'plan-blocked-note' : undefined
            }
          >
            <Play size={14} aria-hidden="true" />
            {p.activate}
          </Button>
        )}
        {plan.status === 'ACTIVE' && (
          <Button
            onClick={() => setApplyOpen(true)}
            disabled={pending || closed !== null}
          >
            <Send size={14} aria-hidden="true" />
            {p.apply}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="danger"
            onClick={() => setConfirming(true)}
            disabled={pending || (closed !== null && plan.status === 'ACTIVE')}
          >
            <X size={14} aria-hidden="true" />
            {p.cancel}
          </Button>
        )}
      </div>
      {closed && (plan.status === 'DRAFT' || plan.status === 'ACTIVE') && (
        <p className="mt-2 text-xs text-warning">{closed}</p>
      )}
      {plan.blocksActivation && plan.status === 'DRAFT' && (
        <p id="plan-blocked-note" className="sr-only">
          {messageText(copy, 'MSG18')}
        </p>
      )}
      {error !== null && deviation?.kind !== 'confirm' && (
        <Alert
          tone="danger"
          title={activationErrorText(copy, error, plan)}
          className="mt-3 w-full"
        >
          {errorCode === 'PLAN_LIMIT_REACHED' && (
            <Link to="/subscription" className="font-medium">
              {p.upgrade}
            </Link>
          )}
          {errorCode === 'TRADING_BLOCKING_WARNING' && p.blockedHint}
          {deviation?.kind === 'refused' && plan.editable && (
            <span>
              {p.deviationEditHint}{' '}
              <Link to={`/plans/${plan.id}/edit`} className="font-medium">
                {p.edit}
              </Link>
            </span>
          )}
        </Alert>
      )}
      <EntryDeviationDialog
        deviation={
          deviationOpen && deviation?.kind === 'confirm' ? deviation : null
        }
        pending={pending}
        onConfirm={() => void onActivate(true)}
        onClose={() => setDeviationOpen(false)}
      />
      <Dialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title={p.applyTitle}
        description={p.applyBody}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>
              {p.keepPlan}
            </Button>
            <Button
              onClick={() => void onApply()}
              disabled={applying}
              aria-busy={applying}
            >
              {p.applyConfirm}
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-dim">{p.applyEntry}</dt>
          <dd className="font-mono">
            {p[`direction${plan.direction}`]} · {plan.entryType}
            {plan.entryType === 'MARKET' ? '' : ` @ ${plan.entryPrice}`}
          </dd>
          <dt className="text-muted-dim">{p.applyQuantity}</dt>
          <dd className="font-mono">{plan.snapshot.positionQuantity}</dd>
          <dt className="text-muted-dim">{p.applyStopLoss}</dt>
          <dd className="font-mono">{plan.stopLoss}</dd>
          <dt className="text-muted-dim">{p.applyTakeProfit}</dt>
          <dd className="font-mono">{plan.takeProfit ?? p.applyNone}</dd>
          {plan.leverage !== null && (
            <>
              <dt className="text-muted-dim">{p.applyLeverage}</dt>
              <dd className="font-mono">{plan.leverage}x</dd>
            </>
          )}
        </dl>
        {plan.entryType === 'STOP' && (
          <p className="mt-3 text-xs text-warning">{p.applyStopHint}</p>
        )}
      </Dialog>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={p.cancel}
        description={messageText(copy, 'MSG20')}
        accent="negative"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {p.keepPlan}
            </Button>
            <Button variant="danger" onClick={() => void onCancel()}>
              {p.cancel}
            </Button>
          </>
        }
      />
    </>
  );
}
