import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorState } from '../../../components/feedback/States';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type {
  JournalTrade,
  MarketPair,
  MarketType,
  PositionStatus,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import { pairLabel } from '../../../utils/pair-label';
import { DirectionText } from '../../trading-plan/components/PlanBadges';
import {
  planAmount,
  planPrice,
  pnlTone,
} from '../../trading-plan/components/plan-format';
import { JOURNAL_PAGE_SIZE, useJournal } from '../hooks/use-journal';

type Filter = 'ALL' | PositionStatus;
const FILTERS: readonly Filter[] = ['ALL', 'OPEN', 'CLOSED'];

/**
 * The journal column of SCR-16 (SCR-20 folded in, UC-22): the trades the
 * Trader's plans filled, the latest entry first, filtered by status and by
 * the pair the page is filtered by. A closed trade shows its net P/L, the
 * one the plan detail shows; a row opens the plan that carried it out.
 */
export function JournalPanel({
  pairId,
  pairOf,
  className,
}: {
  pairId: string;
  pairOf: (pairId: string, market: MarketType) => MarketPair | undefined;
  className?: string;
}) {
  const copy = useCopy();
  const p = copy.plan;
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const journal = useJournal({
    page,
    ...(filter === 'ALL' ? {} : { status: filter }),
    ...(pairId ? { pairId } : {}),
  });
  const pages = Math.max(
    1,
    Math.ceil((journal.data?.total ?? 0) / JOURNAL_PAGE_SIZE),
  );

  return (
    <section
      aria-label={p.journalLabel}
      className={classNames(
        'flex flex-col overflow-hidden rounded-2xl border border-line bg-surface',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-3">
        <BookOpen size={15} aria-hidden="true" className="text-primary" />
        <h2 className="text-sm font-semibold text-fg">{p.journalTitle}</h2>
        {journal.data && (
          <span className="ml-auto text-[11px] text-muted-x">
            {journal.data.total}
          </span>
        )}
      </div>
      <div role="tablist" className="flex gap-1 px-3 pt-2 pb-2.5">
        {FILTERS.map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            aria-selected={filter === each}
            onClick={() => {
              setFilter(each);
              setPage(1);
            }}
            className={classNames(
              'h-6 rounded-md px-2 text-[11px] font-semibold transition-colors duration-150',
              filter === each
                ? 'border border-primary-line bg-primary-soft text-primary'
                : 'text-muted-x hover:text-fg-2',
            )}
          >
            {each === 'ALL' ? p.journalAll : p[`position${each}`]}
          </button>
        ))}
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto border-t border-line">
        {journal.isPending ? (
          [0, 1, 2, 3].map((n) => (
            <li key={n} className="px-3 py-2">
              <Skeleton className="h-12 w-full" />
            </li>
          ))
        ) : journal.isError ? (
          <li className="p-3">
            <ErrorState
              message={errorText(copy, journal.error)}
              onRetry={() => void journal.refetch()}
            />
          </li>
        ) : journal.data.items.length === 0 ? (
          <li className="px-3 py-4 text-xs text-muted-dim">
            {pairId || filter !== 'ALL'
              ? p.journalEmptyFiltered
              : p.journalEmpty}
          </li>
        ) : (
          journal.data.items.map((trade) => (
            <li key={trade.id} className="border-b border-line last:border-b-0">
              <TradeRow
                trade={trade}
                pair={pairOf(trade.pairId, trade.market)}
              />
            </li>
          ))
        )}
      </ol>
      {journal.data && journal.data.total > JOURNAL_PAGE_SIZE && (
        <nav
          aria-label={formatCopy(p.pageOf, { page, pages })}
          className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11px] text-muted"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label={p.previous}
            className="inline-flex size-6 items-center justify-center rounded-md hover:bg-raised disabled:opacity-40"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <span aria-live="polite">
            {formatCopy(p.pageOf, { page, pages })}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            aria-label={p.next}
            className="inline-flex size-6 items-center justify-center rounded-md hover:bg-raised disabled:opacity-40"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
}

function TradeRow({
  trade,
  pair,
}: {
  trade: JournalTrade;
  pair: MarketPair | undefined;
}) {
  const p = useCopy().plan;
  const symbol = pair ? pairLabel(pair.symbol) : '—';
  const net = trade.netPnl;
  const tone = net === null ? 'neutral' : pnlTone(net);
  const body = (
    <>
      <span className="flex items-center gap-1.5">
        <span className="truncate text-xs font-semibold text-fg">{symbol}</span>
        <span className="text-[10px] uppercase text-muted-x">
          {trade.market}
          {trade.leverage !== null ? ` ${trade.leverage}x` : ''}
        </span>
        <span className="ml-auto">
          <DirectionText direction={trade.direction} />
        </span>
      </span>
      <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted">
        <span>
          {formatCopy(p.journalEntryAt, { price: planPrice(trade.entryPrice) })}
        </span>
        {trade.exitPrice !== null && (
          <span>
            {formatCopy(p.journalExitAt, { price: planPrice(trade.exitPrice) })}
          </span>
        )}
      </span>
      <span className="mt-0.5 flex items-center gap-2 text-[10px]">
        <span
          className={classNames(
            'rounded px-1.5 py-px font-semibold',
            trade.status === 'OPEN'
              ? 'bg-primary-soft text-primary'
              : 'bg-raised text-fg-2',
          )}
        >
          {trade.status === 'CLOSED' && trade.closeReason
            ? p[`close${trade.closeReason}`]
            : p[`position${trade.status}`]}
        </span>
        {trade.source === 'MANUAL' && (
          <span className="text-muted-x">{p.journalManual}</span>
        )}
        <time
          dateTime={trade.exitTime ?? trade.entryTime}
          title={formatInstantUtc(trade.exitTime ?? trade.entryTime)}
          className="text-muted-x"
        >
          {formatInstantLocal(trade.exitTime ?? trade.entryTime)}
        </time>
        {net !== null && (
          <span
            title={trade.provisional ? p.journalProvisional : p.journalNet}
            className={classNames(
              'ml-auto font-mono font-semibold',
              tone === 'positive' && 'text-positive',
              tone === 'negative' && 'text-negative',
              tone === 'neutral' && 'text-fg-2',
            )}
          >
            {tone === 'positive' ? '+' : ''}
            {planAmount(net)}
            {trade.provisional ? '*' : ''}
          </span>
        )}
      </span>
    </>
  );
  const rowClass =
    'block px-3 py-2 no-underline transition-colors duration-150';
  return trade.planId ? (
    <Link
      to={`/plans/${trade.planId}`}
      aria-label={formatCopy(p.journalOpenTrade, { symbol })}
      className={classNames(rowClass, 'hover:bg-raised')}
    >
      {body}
    </Link>
  ) : (
    <div className={rowClass}>{body}</div>
  );
}
