import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
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
import { useJournalEntry } from '../../features/journal/hooks/use-journal-entry';
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
