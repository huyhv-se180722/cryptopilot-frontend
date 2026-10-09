import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { PlanListQuery, TradingPlan } from '../../../types/domain';

/** CR-04: 20 rows per page. */
export const PLAN_PAGE_SIZE = 20;

const LIST_KEY = ['plans', 'list'] as const;
const detailKey = (id: string) => ['plans', 'detail', id] as const;

/**
 * One page of the Trader's plans (SCR-16). The previous page stays on
 * screen while the next tab, filter or page loads.
 */
export function usePlanList(query: PlanListQuery) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, query],
    queryFn: ({ signal }) => tradingPlan.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

/**
 * ACTIVE plans for the `ACTIVE_PLAN_MAX` banner, read only when the plan
 * has a limit. The backend counts open positions too (BR-62); none exist
 * before the matching engine fills a plan.
 */
export function useActivePlanCount(enabled: boolean) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, 'active-count'],
    queryFn: ({ signal }) =>
      tradingPlan
        .list({ tab: 'ACTIVE', page: 1, pageSize: 1 }, signal)
        .then((page) => page.total),
    enabled,
  });
}

/** One plan with snapshot, warnings and status history (SCR-18). */
export function usePlan(id: string) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: detailKey(id),
    queryFn: ({ signal }) => tradingPlan.get(id, signal),
  });
}

/**
 * Activate (UC-18) and cancel (UC-19). The answer replaces the shown plan,
 * and every list is read again; nothing changes before the server answers.
 */
export function usePlanActions(id: string) {
  const { tradingPlan } = useServices();
  const client = useQueryClient();
  const settle = useCallback(
    (plan: TradingPlan) => {
      client.setQueryData(detailKey(id), plan);
      void client.invalidateQueries({ queryKey: LIST_KEY });
      return plan;
    },
    [client, id],
  );
  const activate = useMutation(
    useCallback(
      () => tradingPlan.activate(id).then(settle),
      [tradingPlan, id, settle],
    ),
  );
  const cancel = useMutation(
    useCallback(
      () => tradingPlan.cancel(id).then(settle),
      [tradingPlan, id, settle],
    ),
  );
  /** After a 409 (another tab, a fill) the plan is read again. */
  const reload = useCallback(
    () => void client.invalidateQueries({ queryKey: detailKey(id) }),
    [client, id],
  );
  return { activate, cancel, reload };
}
