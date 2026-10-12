import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Bot, ClipboardList, Star } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { usePlanLimit } from '../../../hooks/use-entitlement';
import { messageText } from '../../../i18n/messages';

/**
 * SCR-10 actions (SRS 3.3.2). Watchlist, alert and plan take the pair's id,
 * which no endpoint returns yet (FEQ-01): they stay disabled and say so.
 * Ask AI is PRO and PREMIUM only: on a plan without AI questions it shows
 * MSG29; otherwise it opens SCR-29 with the pair.
 */
export function AnalysisActions({ symbol }: { symbol: string }) {
  const copy = useCopy();
  const a = copy.analysis;
  const aiQuota = usePlanLimit('AI_CHAT_DAILY');
  const [upsell, setUpsell] = useState(false);
  const blocked = [
    { label: a.addWatchlist, icon: Star },
    { label: a.createAlert, icon: Bell },
    { label: a.createPlan, icon: ClipboardList },
  ];
  return (
    <section
      aria-labelledby="analysis-actions-title"
      className="rounded-xl border border-line bg-surface p-4"
    >
      <h2
        id="analysis-actions-title"
        className="mb-2 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {a.actionsTitle}
      </h2>
      <div className="grid grid-cols-1 gap-2">
        {blocked.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            variant="secondary"
            disabled
            aria-describedby="analysis-actions-note"
            className="justify-start"
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </Button>
        ))}
        {aiQuota === 0 ? (
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => setUpsell(true)}
          >
            <Bot size={14} aria-hidden="true" />
            {a.askAi}
          </Button>
        ) : (
          <Link
            to={`/ai?symbol=${encodeURIComponent(symbol)}&market=spot`}
            className={buttonClassName(
              'secondary',
              'md',
              'justify-start no-underline',
            )}
          >
            <Bot size={14} aria-hidden="true" />
            {a.askAi}
          </Link>
        )}
      </div>
      <p id="analysis-actions-note" className="mt-2 text-[11px] text-muted-dim">
        {a.actionsPending}
      </p>
      <Dialog
        open={upsell}
        onOpenChange={setUpsell}
        title={a.askAi}
        description={messageText(copy, 'MSG29', [], { plan: 'PRO' })}
        accent="primary"
        footer={
          <Link
            to="/subscription"
            className={buttonClassName('primary', 'md', 'no-underline')}
          >
            {a.viewPlans}
          </Link>
        }
      />
    </section>
  );
}
