import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type {
  PerformanceBreakdownKind,
  PerformanceFilter,
} from '../../../types/domain';

/**
 * Under the plan list's key, as the journal: closing a position, which
 * invalidates `['plans', 'list']`, reads the statistics again too.
 */
const KEY = ['plans', 'list', 'performance'] as const;

export function usePerformanceSummary(filter: PerformanceFilter) {
  const { performance } = useServices();
  return useQuery({
    queryKey: [...KEY, 'summary', filter],
    queryFn: ({ signal }) => performance.summary(filter, signal),
    placeholderData: keepPreviousData,
  });
}

/** `enabled` keeps FREE away from the endpoints its plan does not open. */
export function usePerformanceBreakdown(
  kind: PerformanceBreakdownKind,
  filter: PerformanceFilter,
  enabled: boolean,
) {
  const { performance } = useServices();
  return useQuery({
    queryKey: [...KEY, 'breakdown', kind, filter],
    queryFn: ({ signal }) => performance.breakdown(kind, filter, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useEquityCurve(filter: PerformanceFilter, enabled: boolean) {
  const { performance } = useServices();
  return useQuery({
    queryKey: [...KEY, 'equity-curve', filter],
    queryFn: ({ signal }) => performance.equityCurve(filter, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}
