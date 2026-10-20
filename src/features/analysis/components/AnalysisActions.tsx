import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Bot, ClipboardList, Star } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { usePlanLimit } from '../../../hooks/use-entitlement';
import { messageText } from '../../../i18n/messages';
import type { MarketType } from '../../../types/domain';

/**
 * SCR-10 / SCR-11 actions (SRS 3.3.2, 3.3.3), on the pair id the market
 * list gives (FEQ-01). Add to watchlist appends the pair (UC-12), or shows
 * it is watched; Create alert opens SCR-14 on the pair, which the server
 * adds to the watchlist when it is not there yet (BR-16). Create trading
 * plan opens SCR-17 on the pair (`planHref`); without it, as on Futures
 * until leverage brackets exist, it stays disabled and says why. Ask AI is PRO and
 * PREMIUM only: on a plan without AI questions it shows MSG29; otherwise it
 * opens SCR-29 with the pair.
 */
export function AnalysisActions({
  market,
  symbol,
  watched,
  adding,
  onAddWatchlist,
  onCreateAlert,
  planHref,
}: {
  market: MarketType;
  symbol: string;
  /** The pair is in the Trader's watchlist; undefined while unknown. */
  watched: boolean | undefined;
  /** An add is on its way. */
  adding: boolean;
  onAddWatchlist: () => void;
  /** Opens SCR-14 on the pair; absent while its markets are unknown. */
  onCreateAlert: (() => void) | undefined;
  /** SCR-17 on the pair; absent while plans cannot be created here. */
  planHref?: string;
}) {
  const copy = useCopy();
  const a = copy.analysis;
  const aiQuota = usePlanLimit('AI_CHAT_DAILY');
  const [upsell, setUpsell] = useState(false);
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
        <Button
          variant="secondary"
          className="justify-start"
          disabled={watched !== false || adding}
          onClick={onAddWatchlist}
        >
          <Star
            size={14}
            aria-hidden="true"
            className={watched ? 'fill-warning text-warning' : undefined}
          />
          {watched ? a.inWatchlist : a.addWatchlist}
        </Button>
        <Button
          variant="secondary"
          className="justify-start"
          disabled={!onCreateAlert}
          onClick={onCreateAlert}
        >
          <Bell size={14} aria-hidden="true" />
          {a.createAlert}
        </Button>
        {planHref ? (
          <Link
            to={planHref}
            className={buttonClassName(
              'secondary',
              'md',
              'justify-start no-underline',
            )}
          >
            <ClipboardList size={14} aria-hidden="true" />
            {a.createPlan}
          </Link>
        ) : (
          <Button
            variant="secondary"
            disabled
            aria-describedby="analysis-actions-note"
            className="justify-start"
          >
            <ClipboardList size={14} aria-hidden="true" />
            {a.createPlan}
          </Button>
        )}
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
            to={`/ai?symbol=${encodeURIComponent(symbol)}&market=${market}`}
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
      {!planHref && (
        <p
          id="analysis-actions-note"
          className="mt-2 text-[11px] text-muted-dim"
        >
          {a.planPending}
        </p>
      )}
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
