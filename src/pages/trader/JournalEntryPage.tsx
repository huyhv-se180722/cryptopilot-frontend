import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { buttonClassName } from '../../components/ui/button-styles';
import { ErrorState } from '../../components/feedback/States';
import { Card } from '../../components/ui/Card';
import { SectionTitle } from '../../components/ui/SectionTitle';
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
  useDeleteManualTrade,
  useJournalEntry,
} from '../../features/journal/hooks/use-journal-entry';
import { tradeResult } from '../../features/journal/model/trade-result';
import { DirectionText } from '../../features/trading-plan/components/PlanBadges';
import { classNames } from '../../utils/class-names';
import { formatInstantLocal } from '../../utils/instant-format';
import { pairLabel } from '../../utils/pair-label';

/**
 * SCR-21 Journal entry (UC-23): the facts of one trade, what a simulated
 * trade teaches (BR-70, D-111) and its review. From the Figma journal's
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
          <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-lg font-semibold text-fg">
              {formatCopy(j.entryTitle, {
                symbol,
                market: copy.market[entry.trade.market],
              })}
            </h1>
            <DirectionText direction={entry.trade.direction} />
            <span className="rounded border border-line px-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
              {copy.performance[`source${entry.trade.source}`]}
            </span>
            <span className="text-xs text-muted-dim">
              {formatInstantLocal(entry.trade.entryTime)}
            </span>
            {entry.trade.planId && (
              <Link
                to={`/plans/${entry.trade.planId}`}
                className="ml-auto text-xs font-medium"
              >
                {j.openPlan}
              </Link>
            )}
            {entry.trade.source === 'MANUAL' && (
              <div className="ml-auto flex gap-2">
                <Link
                  to={`/journal/new?edit=${entry.trade.id}`}
                  className={buttonClassName('secondary', 'sm', 'no-underline')}
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
              </div>
            )}
          </header>
          <div
            className={classNames(
              'mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3',
              result === 'WIN'
                ? 'border-positive-line bg-positive-soft'
                : result === 'LOSS'
                  ? 'border-negative-line bg-negative-soft'
                  : 'border-line bg-surface',
            )}
          >
            <span className="text-xs font-semibold text-fg">
              {result ? j[`result${result}`] : j.resultOPEN}
            </span>
            <span className="text-base font-bold">
              <AmountValue value={entry.trade.netPnl} />
            </span>
          </div>
          {entry.trade.provisional && (
            <p className="mb-4 text-[11px] text-warning">
              {copy.plan.journalProvisional}
            </p>
          )}
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <Card>
                <SectionTitle>{j.tradeTitle}</SectionTitle>
                <TradeFacts trade={entry.trade} />
              </Card>
              {entry.learning && (
                <Card>
                  <SectionTitle>{j.learningTitle}</SectionTitle>
                  <LearningCard
                    learning={entry.learning}
                    symbol={symbol}
                    entryPrice={entry.trade.entryPrice}
                  />
                </Card>
              )}
            </div>
            <Card className="self-start">
              <ReviewCard entry={entry} symbol={symbol} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
