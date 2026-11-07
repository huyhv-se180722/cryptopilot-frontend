import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/feedback/States';
import { PageHeader } from '../../components/layout/PageHeader';
import { buttonClassName } from '../../components/ui/button-styles';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  PerformanceAdvancedCard,
  PerformanceCards,
} from '../../features/journal/components/PerformanceCards';
import {
  EquityCurveCard,
  PerformanceBreakdowns,
} from '../../features/journal/components/PerformanceCharts';
import { PerformanceFilters } from '../../features/journal/components/PerformanceFilters';
import { PerformanceLock } from '../../features/journal/components/PerformanceLock';
import { filterErrors } from '../../features/journal/components/performance-errors';
import { usePairOptions } from '../../features/journal/hooks/use-pair-options';
import {
  usePerformanceBreakdown,
  usePerformanceSummary,
} from '../../features/journal/hooks/use-performance';
import {
  readView,
  viewFilter,
  viewParams,
  type PerformanceView,
} from '../../features/journal/model/performance-view';
import { useCopy } from '../../hooks/use-copy';
import { useFeature } from '../../hooks/use-entitlement';
import { errorText, messageText } from '../../i18n/messages';
import { businessDay } from '../../utils/business-day';

/**
 * Performance dashboard (SCR-23, UC-25, BR-41, BR-42, BR-62): what every
 * plan sees, then the metrics, curve and breakdowns of PRO and PREMIUM.
 * FREE never calls those four reads; a refused one still shows the lock.
 */
export function PerformancePage() {
  const copy = useCopy();
  const p = copy.performance;
  const [params, setParams] = useSearchParams();
  const view = readView(params);
  const today = businessDay();
  const access = useFeature('ADVANCED_PERFORMANCE');
  const filter = viewFilter(view, today, access !== 'locked');
  const summary = usePerformanceSummary(filter);
  const advanced = summary.data?.advanced;
  // An unknown plan waits for the server's answer on `advanced`.
  const advancedOn =
    access === 'allowed' ? advanced !== null : advanced != null;
  const pairs = usePairOptions(view.market);

  const strategyRows = usePerformanceBreakdown(
    'strategy',
    viewFilter(view, today, false),
    advancedOn,
  );
  const strategies = useMemo(
    () =>
      strategyRows.data?.flatMap((row) =>
        row.key === null ? [] : [{ id: row.key, label: row.label }],
      ) ?? [],
    [strategyRows.data],
  );

  const change = (next: Partial<PerformanceView>) => {
    const merged = { ...view, ...next };
    // Another market may not list the chosen pair.
    if (next.market !== undefined && next.market !== view.market)
      merged.pairId = '';
    setParams(viewParams(merged), { replace: true });
  };

  const errors = summary.isError
    ? filterErrors(copy, summary.error, view.to || today)
    : {};
  const journalQuery = new URLSearchParams();
  if (view.market !== 'all') journalQuery.set('market', view.market);
  if (view.pairId) journalQuery.set('pair', view.pairId);
  const journalSearch = journalQuery.toString();

  return (
    <div className="w-full">
      <PageHeader
        title={p.title}
        description={p.subtitle}
        actions={
          <Link
            to={'/journal' + (journalSearch ? '?' + journalSearch : '')}
            className={buttonClassName('secondary', 'sm', 'no-underline')}
          >
            <BookOpen size={13} aria-hidden="true" />
            {p.openJournal}
          </Link>
        }
      />
      <PerformanceFilters
        view={view}
        pairs={pairs}
        strategies={advancedOn ? strategies : null}
        errors={errors}
        onChange={change}
      />
      {summary.isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-20 w-full" />
          ))}
        </div>
      ) : summary.isError ? (
        Object.keys(errors).length === 0 && (
          <ErrorState
            message={errorText(copy, summary.error)}
            onRetry={() => void summary.refetch()}
          />
        )
      ) : summary.data.trades === 0 ? (
        <EmptyState title={messageText(copy, 'MSG41')} />
      ) : (
        <>
          <PerformanceCards summary={summary.data} />
          {summary.data.advanced ? (
            <PerformanceAdvancedCard advanced={summary.data.advanced} />
          ) : (
            <PerformanceLock title={p.advancedTitle} />
          )}
          {advancedOn ? (
            <>
              <EquityCurveCard
                filter={filter}
                from={filter.from ?? summary.data.from}
              />
              <PerformanceBreakdowns filter={filter} />
            </>
          ) : (
            <>
              <PerformanceLock title={p.curveTitle} />
              <PerformanceLock title={p.breakdownTitle} />
            </>
          )}
        </>
      )}
    </div>
  );
}
