import { useCallback, useRef } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation, type MutationState } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import { problemOf } from '../../../services/api/errors';
import { decodeDeviation } from '../../../services/api/trading-plan-dto';
import type { MarketType, PlanTab, TradingPlan } from '../../../types/domain';

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

/** The largest page `GET /plans` serves (CR-04). */
const MAX_PAGE = 100;

/**
 * The slots `ACTIVE_PLAN_MAX` counts (BR-62, T-048a): ACTIVE plans plus
 * the open positions of EXECUTED plans, read only when the plan has a
 * limit. The list has no filter by position status, so the Executed tab
 * is read whole and its OPEN rows counted.
 */
export function useActivePlanCount(enabled: boolean) {
  const { tradingPlan } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, 'count', 'slots'],
    queryFn: async ({ signal }) => {
      const active = await tradingPlan.list(
        { tab: 'ACTIVE', page: 1, pageSize: 1 },
        signal,
      );
      let open = 0;
      for (let page = 1; ; page++) {
        const executed = await tradingPlan.list(
          { tab: 'EXECUTED', page, pageSize: MAX_PAGE },
          signal,
        );
        open += executed.items.filter(
          (row) => row.positionStatus === 'OPEN',
        ).length;
        if (page * MAX_PAGE >= executed.total || executed.items.length === 0)
          break;
      }
      return active.total + open;
    },
    enabled,
  });
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

/**
 * How often the plan of an OPEN position is read again for its current
 * price and unrealized P/L: the guide documents no push of them (only
 * `/user/queue/positions` on a close), so the detail polls (CR-09).
 */
export const POSITION_REFRESH_MS = 10_000;

/**
 * One plan with snapshot, warnings, status history and position (SCR-18).
 * `missing` is the 404 the API answers for an unknown plan or another
 * account's. While the position is OPEN the plan is read every 10 s;
 * `freshness` is `delayed` when the last read failed or the server has no
 * current price, else `live`.
 */
export function usePlan(id: string) {
  const { tradingPlan } = useServices();
  const query = useQuery({
    queryKey: detailKey(id),
    queryFn: ({ signal }) => tradingPlan.get(id, signal),
    retry: (count, error) =>
      problemOf(error)?.code !== 'RESOURCE_NOT_FOUND' && count < 2,
    refetchInterval: (current) =>
      current.state.data?.position?.status === 'OPEN'
        ? POSITION_REFRESH_MS
        : false,
  });
  const position = query.data?.position;
  return {
    ...query,
    freshness:
      query.isRefetchError || position?.currentPrice === null
        ? ('delayed' as const)
        : ('live' as const),
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
 * read again. Nothing changes before the server answers, and a second
 * request is not sent while one runs. `errorCode` is the refusal's code
 * (e.g. `PLAN_LIMIT_REACHED`, `TRADING_BLOCKING_WARNING`); `deviation` the
 * body of MSG51 / MSG52 (TP-C): `activate(true)` repeats the activation
 * with the Trader's confirmation, `dismiss` drops the refusal.
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
  // No double submit: the state only says pending on the next render.
  const busy = useRef(false);
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
  const activate = useCallback(
    async (confirmDeviation = false) => {
      if (busy.current) return false;
      busy.current = true;
      try {
        resetCancellation();
        return finish(await runActivation(confirmDeviation));
      } finally {
        busy.current = false;
      }
    },
    [finish, runActivation, resetCancellation],
  );
  const cancel = useCallback(async () => {
    if (busy.current) return false;
    busy.current = true;
    try {
      resetActivation();
      return finish(await runCancellation());
    } finally {
      busy.current = false;
    }
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
    dismiss: resetActivation,
    pending: activation.pending || cancellation.pending,
    error,
    errorCode: problemOf(error)?.code ?? null,
    deviation: decodeDeviation(problemOf(error)),
  };
}
