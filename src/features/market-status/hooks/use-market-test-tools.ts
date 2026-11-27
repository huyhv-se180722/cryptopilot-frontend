import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import {
  toolsAbsent,
  type RunningReplay,
} from '../../../services/api/market-test-tools';
import type { HealthMarket } from '../../../services/api/market-status';
import { MARKET_STATUS_KEY } from './use-market-status';

const TOOLS_KEY = ['market-test-tools'] as const;
const SCENARIOS_KEY = [...TOOLS_KEY, 'scenarios'] as const;
const REPLAYS_KEY = [...TOOLS_KEY, 'replays'] as const;
/** How often the running replays and their prices are read again. */
export const REPLAYS_REFRESH_MS = 2_000;

/**
 * The replay scenarios of a test environment (RF-07). Fails with a 404 (or
 * NOT_CONFIGURED) where the backend has no test tools: not retried, the
 * console then leaves the tools out.
 */
export function useReplayScenarios() {
  const { marketTestTools } = useServices();
  return useQuery({
    queryKey: SCENARIOS_KEY,
    queryFn: ({ signal }) => marketTestTools.scenarios(signal),
    retry: (count, error) => !toolsAbsent(error) && count < 2,
    staleTime: Infinity,
  });
}

/** The replays running now, read again every two seconds while shown. */
export function useRunningReplays(enabled: boolean) {
  const { marketTestTools } = useServices();
  return useQuery({
    queryKey: REPLAYS_KEY,
    queryFn: ({ signal }) => marketTestTools.replays(signal),
    enabled,
    refetchInterval: REPLAYS_REFRESH_MS,
  });
}

function useAfterReplayChange() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ queryKey: REPLAYS_KEY }),
    [client],
  );
}

/** Starts a replay on its pair, replacing the one running there; audited. */
export function useStartReplay() {
  const { marketTestTools } = useServices();
  const after = useAfterReplayChange();
  return useMutation(
    useCallback(
      async (scenario: string): Promise<RunningReplay> => {
        const replay = await marketTestTools.startReplay(scenario);
        await after();
        return replay;
      },
      [marketTestTools, after],
    ),
  );
}

/** Stops the replay of a pair, back to the exchange's prices; audited. */
export function useStopReplay() {
  const { marketTestTools } = useServices();
  const after = useAfterReplayChange();
  return useMutation(
    useCallback(
      async (market: HealthMarket, symbol: string) => {
        await marketTestTools.stopReplay(market, symbol);
        await after();
      },
      [marketTestTools, after],
    ),
  );
}

/** Cuts a market's exchange streams for a while (RF-12); audited. */
export function useCutStreams() {
  const { marketTestTools } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (market: HealthMarket, outageSeconds: number) => {
        const cut = await marketTestTools.cutStreams(market, outageSeconds);
        await client.invalidateQueries({ queryKey: MARKET_STATUS_KEY });
        return cut;
      },
      [marketTestTools, client],
    ),
  );
}
