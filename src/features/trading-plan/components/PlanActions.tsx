import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Play, X } from 'lucide-react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { errorText, messageText } from '../../../i18n/messages';
import type { TradingPlan } from '../../../types/domain';
import { usePlanActions } from '../hooks/use-plans';

/**
 * SCR-18 actions (SRS 3.5.3): Edit while DRAFT (SCR-17), Activate for a
 * DRAFT (UC-18; the server re-checks price, warnings and the plan limit;
 * MSG19 on success, MSG18 or MSG27 in a banner), Cancel for DRAFT and
 * ACTIVE after the MSG20 confirmation (UC-19). Buttons are disabled while
 * a request runs, and nothing changes before the server answers.
 */
export function PlanActions({ plan }: { plan: TradingPlan }) {
  const copy = useCopy();
  const p = copy.plan;
  const { show } = useToast();
  const { activate, cancel, pending, error, errorCode } = usePlanActions(
    plan.id,
  );
  const [confirming, setConfirming] = useState(false);

  async function onActivate() {
    if (await activate())
      show({ tone: 'success', message: messageText(copy, 'MSG19') });
  }

  async function onCancel() {
    setConfirming(false);
    await cancel();
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
            disabled={pending}
            aria-describedby={
              plan.blocksActivation ? 'plan-blocked-note' : undefined
            }
          >
            <Play size={14} aria-hidden="true" />
            {p.activate}
          </Button>
        )}
        {canCancel && (
          <Button
            variant="danger"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            <X size={14} aria-hidden="true" />
            {p.cancel}
          </Button>
        )}
      </div>
      {plan.blocksActivation && plan.status === 'DRAFT' && (
        <p id="plan-blocked-note" className="sr-only">
          {messageText(copy, 'MSG18')}
        </p>
      )}
      {error !== null && (
        <Alert
          tone="danger"
          title={errorText(copy, error)}
          className="mt-3 w-full"
        >
          {errorCode === 'PLAN_LIMIT_REACHED' && (
            <Link to="/subscription" className="font-medium">
              {p.upgrade}
            </Link>
          )}
          {errorCode === 'TRADING_BLOCKING_WARNING' && p.blockedHint}
        </Alert>
      )}
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
