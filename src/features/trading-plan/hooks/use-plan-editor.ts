import { useCallback, useEffect, useState } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import { problemOf } from '../../../services/api/errors';
import type { PlanInputs, TradingPlan } from '../../../types/domain';

/**
 * Pause after the last keystroke before the panel is calculated again. With
 * a typical answer under 100 ms the panel follows within the 300 ms of
 * SRS 4.2 (risk calculation on SCR-17).
 */
export const CALCULATION_DELAY_MS = 200;

function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * The live risk panel of SCR-17 (`POST /plans/calculate`, nothing saved).
 * Valid inputs are sent once typing pauses; a newer request aborts the one
 * in flight (query signal), and the last good panel stays on screen while
 * the next one loads or when the inputs are refused. `null` = the form has
 * client errors: nothing is sent.
 */
export function usePlanCalculation(pairId: string, inputs: PlanInputs | null) {
  const { tradingPlan } = useServices();
  // Compare by value so a re-render with equal inputs is no new request.
  const key = inputs === null ? null : JSON.stringify(inputs);
  const settled = useSettled(key, CALCULATION_DELAY_MS);
  const query = useQuery({
    queryKey: ['plans', 'calculation', pairId, settled],
    queryFn: ({ signal }) =>
      tradingPlan.calculate(
        pairId,
        JSON.parse(settled as string) as PlanInputs,
        signal,
      ),
    enabled: settled !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });
  return {
    ...query,
    /** The inputs changed and the panel is being brought up to date. */
    updating: key !== settled || query.isFetching,
    fieldErrors: problemOf(query.error)?.fieldErrors ?? {},
  };
}

/** Answers after which the plan on screen is no longer a DRAFT or changed. */
const STALE = new Set([
  'TRADING_PLAN_STATUS_TRANSITION_INVALID',
  'DATA_CONFLICT',
]);

/**
 * Save as Draft or Save and Activate (UC-17). The answer replaces the plan
 * in the cache and the lists are read again; an activation refused with
 * MSG18 or MSG27 saves nothing, and a stale-plan refusal reads it again.
 */
export function useSavePlan(id: string) {
  const { tradingPlan } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (inputs: PlanInputs, activate: boolean): Promise<TradingPlan> => {
        try {
          const plan = await tradingPlan.update(id, inputs, activate);
          client.setQueryData(['plans', 'detail', id], plan);
          void client.invalidateQueries({ queryKey: ['plans', 'list'] });
          return plan;
        } catch (error) {
          if (STALE.has(problemOf(error)?.code ?? ''))
            void client.invalidateQueries({
              queryKey: ['plans', 'detail', id],
            });
          throw error;
        }
      },
      [tradingPlan, client, id],
    ),
  );
}
