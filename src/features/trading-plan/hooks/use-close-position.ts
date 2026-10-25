import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import { problemOf } from '../../../services/api/errors';
import type { TradingPlan } from '../../../types/domain';

/** SCR-19 re-reads the estimate this often while it is open. */
export const ESTIMATE_REFRESH_MS = 5_000;

/**
 * What closing the plan's OPEN position now would give (SCR-19), read when
 * the dialog opens and every 5 s while it stays open. The last estimate
 * stays on screen while the next one loads or when a refresh fails.
 * `unavailable` is the 503 MSG43 of a missing current price; `closed` the
 * 409 MSG43 of a position that is no longer OPEN.
 */
export function useCloseEstimate(id: string, enabled: boolean) {
  const { tradingPlan } = useServices();
  const query = useQuery({
    queryKey: ['plans', 'close-estimate', id],
    queryFn: ({ signal }) => tradingPlan.closeEstimate(id, signal),
    enabled,
    refetchInterval: enabled ? ESTIMATE_REFRESH_MS : false,
    retry: false,
    gcTime: 0,
  });
  const code = problemOf(query.error)?.code;
  return {
    ...query,
    unavailable: query.isError && code === 'MARKET_PRICE_UNAVAILABLE',
    closed: query.isError && problemOf(query.error)?.status === 409,
  };
}

/**
 * Close position (UC-21): the answer, with its CLOSED position, replaces
 * the shown plan and the lists are read again. A 409 MSG43 means the
 * engine closed it first: the plan is read again. Never sent twice while
 * one request runs.
 */
export function useClosePosition(id: string) {
  const { tradingPlan } = useServices();
  const client = useQueryClient();
  const busy = useRef(false);
  const mutation = useMutation(
    useCallback(async (): Promise<TradingPlan> => {
      try {
        const plan = await tradingPlan.closePosition(id);
        client.setQueryData(['plans', 'detail', id], plan);
        void client.invalidateQueries({ queryKey: ['plans', 'list'] });
        return plan;
      } catch (error) {
        if (problemOf(error)?.status === 409)
          void client.invalidateQueries({ queryKey: ['plans', 'detail', id] });
        throw error;
      }
    }, [tradingPlan, client, id]),
  );
  const { run } = mutation;
  const close = useCallback(async () => {
    if (busy.current) return null;
    busy.current = true;
    try {
      return await run();
    } finally {
      busy.current = false;
    }
  }, [run]);
  return {
    ...mutation,
    close,
    /** The engine closed the position first (409 MSG43). */
    raced:
      mutation.state.status === 'error' &&
      problemOf(mutation.state.error)?.status === 409,
  };
}
