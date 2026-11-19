import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  HealthMarket,
  MaintenanceInput,
} from '../../../services/api/market-status';
import { MARKET_STATUS_KEY } from './use-market-status';

export type {
  HealthMarket,
  MarketIncident,
} from '../../../services/api/market-status';

const INCIDENTS_KEY = [...MARKET_STATUS_KEY, 'incidents'] as const;
export const INCIDENTS_SHOWN = 20;

/** A market's latest incidents, newest first (D-158), Admin only. */
export function useMarketIncidents(market: HealthMarket) {
  const { marketStatus } = useServices();
  return useQuery({
    queryKey: [...INCIDENTS_KEY, market],
    queryFn: ({ signal }) =>
      marketStatus.incidents(market, INCIDENTS_SHOWN, signal),
  });
}

/** The status the answer gives replaces the cached one; the lists are read again. */
function useAfterChange() {
  const client = useQueryClient();
  return useCallback(
    async (status: unknown) => {
      client.setQueryData(MARKET_STATUS_KEY, status);
      await client.invalidateQueries({ queryKey: INCIDENTS_KEY });
    },
    [client],
  );
}

/** Starts or ends maintenance of a market, audited by the backend. */
export function useMaintenance() {
  const { marketStatus } = useServices();
  const after = useAfterChange();
  return useMutation(
    useCallback(
      async (input: MaintenanceInput) => {
        const status = await marketStatus.maintenance(input);
        await after(status);
        return status;
      },
      [marketStatus, after],
    ),
  );
}

/** Reopens a recovering market by hand, for an outage beyond the replay. */
export function useResumeMarket() {
  const { marketStatus } = useServices();
  const after = useAfterChange();
  return useMutation(
    useCallback(
      async (market: HealthMarket) => {
        const status = await marketStatus.resume(market);
        await after(status);
        return status;
      },
      [marketStatus, after],
    ),
  );
}
