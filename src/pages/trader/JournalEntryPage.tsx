import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { buttonClassName } from '../../components/ui/button-styles';
import { ErrorState } from '../../components/feedback/States';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText, messageText } from '../../i18n/messages';
import { usePairLookup } from '../../features/market/hooks/use-market-data';
import { LearningCard } from '../../features/journal/components/LearningCard';
import { AmountValue } from '../../features/journal/components/PerformanceValues';
import { ReviewCard } from '../../features/journal/components/ReviewCard';
import { TradeFacts } from '../../features/journal/components/TradeFacts';
import {
  emptyLearningFacts,
  emptyTradeFacts,
} from '../../features/journal/components/empty-facts';
import {
  useDeleteManualTrade,
  useJournalEntry,
} from '../../features/journal/hooks/use-journal-entry';
import { tradeResult } from '../../features/journal/model/trade-result';
import { DirectionText } from '../../features/trading-plan/components/PlanBadges';
import { planRatio } from '../../features/trading-plan/components/plan-format';
import { NumericText } from '../../components/ui/NumericText';
import { classNames } from '../../utils/class-names';
import { formatInstantLocal } from '../../utils/instant-format';
import { pairLabel } from '../../utils/pair-label';

/**
 * SCR-21 Journal entry (UC-23): the result of one trade in a summary card,
 * its review first, then its facts in groups and what a simulated trade
 * teaches (BR-70, D-111), the facts not recorded behind "show all". From the Figma journal's
 * detail panel, as a page of its own so it can be linked to (the
 * notifications of a trade open it).
 */
export function JournalEntryPage() {
  const copy = useCopy();
  const j = copy.journal;
  const { entryId = '' } = useParams();
  const query = useJournalEntry(entryId);
  const entry = query.data;
  const pairOf = usePairLookup();
  const pair = entry ? pairOf(entry.trade.pairId, entry.trade.market) : null;
  const symbol = pair ? pairLabel(pair.symbol) : copy.market.noValue;
  const missing = query.missing;
  const result = entry ? tradeResult(entry.trade) : null;
  const navigate = useNavigate();
  const remove = useDeleteManualTrade(entryId);
  const [confirming, setConfirming] = useState(false);
  // Facts the server did not record stay hidden until asked for.
  const [showAll, setShowAll] = useState(false);
  const hidden = entry
    ? emptyTradeFacts(entry.trade) +
      (entry.learning ? emptyLearningFacts(entry.learning) : 0)
    : 0;

  return (
    <div className="w-full">
      <Link
        to="/journal"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted no-underline hover:text-fg-2"
      >
        <ChevronLeft size={13} aria-hidden="true" />
        {j.back}
      </Link>
      {query.isPending ? (
        <Skeleton className="h-96 w-full" aria-label={j.entryLoading} />
      ) : missing ? (
        <p
          role="alert"
          className="rounded-xl border border-line bg-surface p-6 text-sm text-muted"
        >
          {messageText(copy, 'MSG41')}
        </p>
      ) : query.isError || !entry ? (
        <ErrorState
          message={errorText(copy, query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <section
            aria-labelledby="journal-entry-title"
            className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1
                  id="journal-entry-title"
                  className="text-xl font-semibold text-fg"
                >
                  {formatCopy(j.entryTitle, {
                    symbol,
                    market: copy.market[entry.trade.market],
                  })}
                </h1>
                <DirectionText direction={entry.trade.direction} />
                <span
                  className={classNames(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    result === 'WIN'
                      ? 'bg-positive-soft text-positive'
                      : result === 'LOSS'
                        ? 'bg-negative-soft text-negative'
                        : 'bg-raised text-fg-2',
                  )}
                >
                  {result ? j[`result${result}`] : j.resultOPEN}
                </span>
              </div>
              <p className="m-0 text-xs text-muted">
                {[
                  entry.trade.leverage !== null
                    ? `${entry.trade.leverage}x`
                    : null,
                  copy.performance[`source${entry.trade.source}`],
                  copy.plan[`position${entry.trade.status}`],
                  formatInstantLocal(entry.trade.entryTime) +
                    (entry.trade.exitTime
                      ? ' → ' + formatInstantLocal(entry.trade.exitTime)
                      : ''),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <dt className="text-xs font-semibold text-muted">{j.netPnl}</dt>
                <dd className="m-0 font-mono text-xl font-semibold">
                  <AmountValue value={entry.trade.netPnl} />
                </dd>
              </div>
              {entry.learning?.rMultiple != null && (
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    {j.realizedR}
                  </dt>
                  <dd className="m-0 font-mono text-xl font-semibold text-fg">
                    <NumericText
                      value={planRatio(entry.learning.rMultiple)}
                      signed
                      suffix=" R"
                    />
                  </dd>
                </div>
              )}
              {entry.trade.closeReason && (
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    {j.closeReason}
                  </dt>
                  <dd className="m-0 text-base font-semibold text-fg">
                    {copy.plan[`close${entry.trade.closeReason}`]}
                  </dd>
                </div>
              )}
            </dl>
            <div className="ml-auto flex flex-wrap gap-2">
              {entry.trade.planId && (
                <Link
                  to={`/plans/${entry.trade.planId}`}
                  className={buttonClassName('secondary', 'sm', 'no-underline')}
                >
                  {j.openPlan}
                </Link>
              )}
              {entry.trade.source === 'MANUAL' && (
                <>
                  <Link
                    to={`/journal/new?edit=${entry.trade.id}`}
                    className={buttonClassName(
                      'secondary',
                      'sm',
                      'no-underline',
                    )}
                  >
                    <Pencil size={13} aria-hidden="true" />
                    {j.editTrade}
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    {j.deleteTrade}
                  </Button>
                </>
              )}
            </div>
            {entry.trade.provisional && (
              <p className="m-0 w-full text-xs text-warning">
                {copy.plan.journalProvisional}
              </p>
            )}
          </section>
          <Dialog
            open={confirming}
            onOpenChange={(open) => {
              if (!remove.isPending) setConfirming(open);
            }}
            title={j.deleteTitle}
            accent="negative"
            footer={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() => setConfirming(false)}
                >
                  {j.reviewCancel}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(undefined, {
                      onSuccess: () => navigate('/journal', { replace: true }),
                    })
                  }
                >
                  {j.deleteConfirm}
                </Button>
              </>
            }
          >
            <p className="m-0 text-xs text-fg-2">
              {formatCopy(j.deleteBody, { symbol })}
            </p>
            {remove.isError && (
              <p role="alert" className="mt-2 text-xs text-negative">
                {errorText(copy, remove.error)}
              </p>
            )}
          </Dialog>
          {/* The review first, the facts beside it (SCR-21, T-142). */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
            <Card className="self-start">
              <ReviewCard entry={entry} symbol={symbol} />
            </Card>
            <div className="flex min-w-0 flex-col gap-4">
              <TradeFacts trade={entry.trade} showAll={showAll} />
              {entry.learning && (
                <section
                  aria-labelledby="trade-learning-title"
                  className="overflow-hidden rounded-xl border border-line bg-surface"
                >
                  <h2
                    id="trade-learning-title"
                    className="m-0 border-b border-line px-4 py-2.5 text-sm font-semibold text-fg"
                  >
                    {j.learningTitle}
                  </h2>
                  <div className="px-4 py-3">
                    <LearningCard
                      learning={entry.learning}
                      symbol={symbol}
                      entryPrice={entry.trade.entryPrice}
                      showAll={showAll}
                    />
                  </div>
                </section>
              )}
              {hidden > 0 && (
                <button
                  type="button"
                  aria-expanded={showAll}
                  onClick={() => setShowAll((value) => !value)}
                  className="h-9 rounded-lg border border-dashed border-line-strong text-xs text-muted hover:text-fg"
                >
                  {showAll
                    ? j.hideEmpty
                    : formatCopy(j.showEmpty, { count: String(hidden) })}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
