import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import { ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge, type Tone } from '../../components/ui/Badge';
import { buttonClassName } from '../../components/ui/button-styles';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { Table, type Column } from '../../components/ui/Table';
import { AmountValue } from '../../features/journal/components/PerformanceValues';
import { TradeDetailDialog } from '../../features/journal/components/TradeDetailDialog';
import {
  JOURNAL_PAGE_SIZE,
  useJournal,
} from '../../features/journal/hooks/use-journal';
import { usePairOptions } from '../../features/journal/hooks/use-pair-options';
import {
  MARKET_CHOICES,
  marketOfParam,
  type MarketChoice,
} from '../../features/journal/model/performance-view';
import {
  tradeResult,
  type TradeResult,
} from '../../features/journal/model/trade-result';
import { usePairLookup } from '../../features/market/hooks/use-market-data';
import { DirectionText } from '../../features/trading-plan/components/PlanBadges';
import { planPrice } from '../../features/trading-plan/components/plan-format';
import { useCopy } from '../../hooks/use-copy';
import { formatCopy } from '../../i18n/copy';
import { errorText, messageText } from '../../i18n/messages';
import type { JournalTrade, PositionStatus } from '../../types/domain';
import { formatInstantLocal } from '../../utils/instant-format';
import { pairLabel } from '../../utils/pair-label';

const STATUSES: readonly PositionStatus[] = ['OPEN', 'CLOSED'];
const RESULT_TONE: Record<TradeResult, Tone> = {
  WIN: 'success',
  LOSS: 'danger',
  BREAKEVEN: 'neutral',
};

const statusOf = (value: string | null): PositionStatus | undefined =>
  STATUSES.find((status) => status === value);

/**
 * Trading journal (SCR-20, UC-22): the filters `GET /journal` takes, kept
 * in the URL. A row opens its facts (SCR-21); strategy, period, source and
 * result filters and the strategy column wait for the API to carry them.
 */
export function JournalPage() {
  const copy = useCopy();
  const j = copy.journal;
  const p = copy.performance;
  const [params, setParams] = useSearchParams();
  const status = statusOf(params.get('status'));
  const market = marketOfParam(params.get('market'));
  const pairId = params.get('pair') ?? '';
  const page = Math.max(1, Math.trunc(Number(params.get('page'))) || 1);
  const journal = useJournal({
    page,
    ...(status ? { status } : {}),
    ...(market === 'all' ? {} : { market }),
    ...(pairId ? { pairId } : {}),
  });
  const pairs = usePairOptions(market);
  const pairOf = usePairLookup();
  const [openId, setOpenId] = useState<string | null>(null);

  const symbolOf = useMemo(
    () => (trade: JournalTrade) => {
      const pair = pairOf(trade.pairId, trade.market);
      return pair ? pairLabel(pair.symbol) : copy.market.noValue;
    },
    [pairOf, copy.market.noValue],
  );

  const update = (change: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [name, value] of Object.entries(change))
      if (value) next.set(name, value);
      else next.delete(name);
    setParams(next, { replace: true });
  };

  const columns = useMemo<readonly Column<JournalTrade>[]>(
    () => [
      {
        id: 'pair',
        header: j.columnPair,
        render: (trade) => {
          const symbol = symbolOf(trade);
          return (
            <button
              type="button"
              aria-label={formatCopy(j.openTrade, { symbol })}
              onClick={() => setOpenId(trade.id)}
              className="font-semibold text-fg hover:text-primary"
            >
              {symbol}
            </button>
          );
        },
      },
      {
        id: 'market',
        header: j.columnMarket,
        render: (trade) => copy.market[trade.market],
      },
      {
        id: 'direction',
        header: j.columnDirection,
        render: (trade) => <DirectionText direction={trade.direction} />,
      },
      {
        id: 'entry',
        header: j.columnEntry,
        numeric: true,
        render: (trade) => planPrice(trade.entryPrice),
      },
      {
        id: 'exit',
        header: j.columnExit,
        numeric: true,
        render: (trade) =>
          trade.exitPrice === null
            ? copy.market.noValue
            : planPrice(trade.exitPrice),
      },
      {
        id: 'net',
        header: j.columnNetPnl,
        numeric: true,
        render: (trade) => (
          <span title={trade.provisional ? copy.plan.journalProvisional : ''}>
            <AmountValue value={trade.netPnl} />
            {trade.provisional ? '*' : ''}
          </span>
        ),
      },
      {
        id: 'result',
        header: j.columnResult,
        render: (trade) => {
          const result = tradeResult(trade);
          return result ? (
            <Badge tone={RESULT_TONE[result]}>{j[`result${result}`]}</Badge>
          ) : (
            copy.market.noValue
          );
        },
      },
      {
        id: 'source',
        header: j.columnSource,
        render: (trade) => p[`source${trade.source}`],
      },
      {
        id: 'status',
        header: j.columnStatus,
        render: (trade) => copy.plan[`position${trade.status}`],
      },
      {
        id: 'entryTime',
        header: j.columnEntryTime,
        render: (trade) => formatInstantLocal(trade.entryTime),
      },
    ],
    [copy, j, p, symbolOf],
  );

  const open = journal.data?.items.find((trade) => trade.id === openId);
  const performanceQuery = new URLSearchParams();
  if (market !== 'all') performanceQuery.set('market', market);
  if (pairId) performanceQuery.set('pair', pairId);
  const performanceSearch = performanceQuery.toString();
  const pairListed = pairs.some((pair) => pair.pairId === pairId);

  return (
    <div className="w-full">
      <PageHeader
        title={j.title}
        description={j.subtitle}
        actions={
          <Link
            to={
              '/performance' +
              (performanceSearch ? '?' + performanceSearch : '')
            }
            className={buttonClassName('secondary', 'sm', 'no-underline')}
          >
            <BarChart2 size={13} aria-hidden="true" />
            {j.openPerformance}
          </Link>
        }
      />
      <section
        aria-label={j.filtersLabel}
        className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3"
      >
        <Select
          label={j.status}
          value={status ?? ''}
          onChange={(event) => update({ status: event.target.value, page: '' })}
        >
          <option value="">{j.statusAll}</option>
          {STATUSES.map((each) => (
            <option key={each} value={each}>
              {copy.plan[`position${each}`]}
            </option>
          ))}
        </Select>
        <Select
          label={p.market}
          value={market}
          onChange={(event) =>
            update({
              market:
                (event.target.value as MarketChoice) === 'all'
                  ? ''
                  : event.target.value,
              pair: '',
              page: '',
            })
          }
        >
          {MARKET_CHOICES.map((each) => (
            <option key={each} value={each}>
              {p[`market${each}`]}
            </option>
          ))}
        </Select>
        <Select
          label={p.pair}
          value={pairId}
          onChange={(event) => update({ pair: event.target.value, page: '' })}
        >
          <option value="">{p.pairAll}</option>
          {pairId && !pairListed && (
            <option value={pairId}>{copy.market.noValue}</option>
          )}
          {pairs.map((pair) => (
            <option key={pair.pairId} value={pair.pairId}>
              {pair.label}
            </option>
          ))}
        </Select>
      </section>
      {journal.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : journal.isError ? (
        <ErrorState
          message={errorText(copy, journal.error)}
          onRetry={() => void journal.refetch()}
        />
      ) : (
        <>
          <Table
            caption={j.tableCaption}
            columns={columns}
            rows={journal.data.items}
            rowKey={(trade) => trade.id}
            onRowClick={(trade) => setOpenId(trade.id)}
            emptyMessage={messageText(copy, 'MSG41')}
          />
          <div className="mt-3">
            <Pagination
              page={page}
              total={journal.data.total}
              pageSize={JOURNAL_PAGE_SIZE}
              onChange={(next) =>
                update({ page: next > 1 ? String(next) : '' })
              }
            />
          </div>
        </>
      )}
      {open && (
        <TradeDetailDialog
          trade={open}
          symbol={symbolOf(open)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
