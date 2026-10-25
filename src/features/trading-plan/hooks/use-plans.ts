import { useCallback, useEffect } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation, type MutationState } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import { problemOf } from '../../../services/api/errors';
import type {
  MarketType,
  PlanTab,
  PositionLevels,
  TradingPlan,
} from '../../../types/domain';

/** CR-04: 20 rows per page. */
export const PLAN_PAGE_SIZE = 20;

const LIST_KEY = ['plans', 'list'] as const;
const detailKey = (id: string) => ['plans', 'detail', id] as const;
const DAY_MS = 86_400_000;

export interface PlanListFilter {
  tab: PlanTab;
  page: number;
  pairId?: string;
  market?: MarketType;
  /** Plans created in the last n days; all when absent. */
  periodDays?: number;
}

/**
 * One page of the Trader's plans (SCR-16). The period starts when the page
 * is read; the previous page stays on screen while the next one loads.
 */
export function usePlanList({
  tab,
  page,
  pairId,
  market,
  periodDays,
}: PlanListFilter) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, { tab, page, pairId, market, periodDays }],
    queryFn: ({ signal }) =>
      tradingPlan.list(
        {
          tab,
          page,
          pageSize: PLAN_PAGE_SIZE,
          ...(pairId ? { pairId } : {}),
          ...(market ? { market } : {}),
          ...(periodDays
            ? {
                from: new Date(Date.now() - periodDays * DAY_MS).toISOString(),
              }
            : {}),
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * ACTIVE plans for the `ACTIVE_PLAN_MAX` banner, read only when the plan
 * has a limit. The backend counts open positions too (BR-62); none exist
 * before the matching engine fills a plan.
 */
export function useActivePlanCount(enabled: boolean) {
  return usePlanCount('ACTIVE', enabled);
}

/** How many plans a tab holds: the total of a one-row page. */
export function usePlanCount(tab: PlanTab, enabled = true) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, 'count', tab],
    queryFn: ({ signal }) =>
      tradingPlan
        .list({ tab, page: 1, pageSize: 1 }, signal)
        .then((page) => page.total),
    enabled,
  });
}

/** The largest page the plan list answers (PageResponse). */
const MAX_PAGE = 100;

/**
 * Open positions (SCR-08): the OPEN rows among the newest 100 EXECUTED
 * plans; `more` when older executed plans were not read.
 */
export function useOpenPositionCount() {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, 'open-positions'],
    queryFn: ({ signal }) =>
      tradingPlan
        .list({ tab: 'EXECUTED', page: 1, pageSize: MAX_PAGE }, signal)
        .then((page) => ({
          open: page.items.filter((row) => row.positionStatus === 'OPEN')
            .length,
          more: page.total > page.items.length,
        })),
  });
}

/**
 * One plan with snapshot, warnings and status history (SCR-18). `missing`
 * is the 404 the API answers for an unknown plan or another account's.
 */
export function usePlan(id: string) {
  const { tradingPlan } = useServices();
  const query = useQuery({
    queryKey: detailKey(id),
    queryFn: ({ signal }) => tradingPlan.get(id, signal),
    retry: (count, error) =>
      problemOf(error)?.code !== 'RESOURCE_NOT_FOUND' && count < 2,
  });
  return {
    ...query,
    missing: problemOf(query.error)?.code === 'RESOURCE_NOT_FOUND',
  };
}

/** Answers after which the shown plan is out of date (another tab, a fill). */
const STALE = new Set([
  'TRADING_PLAN_STATUS_TRANSITION_INVALID',
  'DATA_CONFLICT',
]);

/**
 * Activate (UC-18) and cancel (UC-19). The answer replaces the shown plan
 * and every list is read again; after a stale-plan refusal the plan is
 * read again. Nothing changes before the server answers. `errorCode` is
 * the refusal's code (e.g. `PLAN_LIMIT_REACHED`, `TRADING_BLOCKING_WARNING`).
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
  const activation = useMutation(
    useCallback(
      (confirmDeviation: boolean) =>
        tradingPlan.activate(id, confirmDeviation).then(settle),
      [tradingPlan, id, settle],
    ),
  );
  const cancellation = useMutation(
    useCallback(
      () => tradingPlan.cancel(id).then(settle),
      [tradingPlan, id, settle],
    ),
  );

  const finish = useCallback(
    (result: MutationState<TradingPlan>) => {
      if (
        result.status === 'error' &&
        STALE.has(problemOf(result.error)?.code ?? '')
      )
        void client.invalidateQueries({ queryKey: detailKey(id) });
      return result.status === 'success';
    },
    [client, id],
  );
  const { run: runActivation, reset: resetActivation } = activation;
  const { run: runCancellation, reset: resetCancellation } = cancellation;
  /** With `confirmDeviation` after the Trader confirmed MSG51 (TP-C). */
  const activate = useCallback(
    async (confirmDeviation = false) => {
      resetCancellation();
      return finish(await runActivation(confirmDeviation));
    },
    [finish, runActivation, resetCancellation],
  );
  const cancel = useCallback(async () => {
    resetActivation();
    return finish(await runCancellation());
  }, [finish, runCancellation, resetActivation]);

  const error =
    activation.state.status === 'error'
      ? activation.state.error
      : cancellation.state.status === 'error'
        ? cancellation.state.error
        : null;
  return {
    activate,
    cancel,
    pending: activation.pending || cancellation.pending,
    error,
    errorCode: problemOf(error)?.code ?? null,
  };
}

/**
 * TP-E: new levels of the plan's OPEN position (D-124). The answer replaces
 * the shown plan and the lists are read again; when the position is no
 * longer open (409) the plan is read again to show how it ended.
 */
export function usePositionLevels(id: string) {
  const { tradingPlan } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (levels: PositionLevels) => {
        try {
          const plan = await tradingPlan.changeLevels(id, levels);
          client.setQueryData(detailKey(id), plan);
          void client.invalidateQueries({ queryKey: LIST_KEY });
          return plan;
        } catch (error) {
          if (problemOf(error)?.status === 409)
            void client.invalidateQueries({ queryKey: detailKey(id) });
          throw error;
        }
      },
      [tradingPlan, id, client],
    ),
  );
}

/** SCR-19 is read again this often while it is open; it reserves nothing. */
const ESTIMATE_REFRESH_MS = 5_000;

/** The estimated close of the plan's open position, while `enabled` (UC-21). */
export function useCloseEstimate(id: string, enabled: boolean) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: ['plans', 'close-estimate', id],
    queryFn: ({ signal }) => tradingPlan.closeEstimate(id, signal),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: enabled ? ESTIMATE_REFRESH_MS : false,
  });
}

/**
 * Closes the open position at market (UC-21, MANUAL). The answer replaces
 * the shown plan and the lists are read again; a position already closed
 * (409) reads the plan again to show how it ended.
 */
export function useClosePosition(id: string) {
  const { tradingPlan } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(async () => {
      try {
        const plan = await tradingPlan.closePosition(id);
        client.setQueryData(detailKey(id), plan);
        void client.invalidateQueries({ queryKey: LIST_KEY });
        return plan;
      } catch (error) {
        if (problemOf(error)?.status === 409)
          void client.invalidateQueries({ queryKey: detailKey(id) });
        throw error;
      }
    }, [tradingPlan, id, client]),
  );
}

/**
 * Reads the plans again when the server pushes a position change (an exit
 * by take profit, stop loss, liquidation or a close elsewhere; T-048b).
 */
export function usePositionUpdates() {
  const { tradingPlan } = useServices();
  const client = useQueryClient();
  useEffect(
    () =>
      tradingPlan.subscribePositions((update) => {
        void client.invalidateQueries({ queryKey: detailKey(update.planId) });
        void client.invalidateQueries({ queryKey: LIST_KEY });
      }),
    [tradingPlan, client],
  );
}
