import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  Alert,
  AlertRule,
  AlertStatus,
  AlertType,
} from '../../../types/domain';

/** CR-04: 20 rows per page. */
export const ALERT_PAGE_SIZE = 20;

const ALERTS_KEY = ['alerts'] as const;
/** Saving or removing an alert changes `activeAlerts` (and may add a row). */
const WATCHLIST_KEY = ['watchlist'] as const;

export interface AlertListFilter {
  page: number;
  status?: AlertStatus;
  type?: AlertType;
}

/** One page of the Trader's alerts, newest first (SCR-13). */
export function useAlertList({ page, status, type }: AlertListFilter) {
  const { alerts } = useServices();
  return useQuery({
    queryKey: [...ALERTS_KEY, { page, status, type }],
    queryFn: ({ signal }) =>
      alerts.list(
        {
          page,
          pageSize: ALERT_PAGE_SIZE,
          ...(status ? { status } : {}),
          ...(type ? { type } : {}),
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

function useRefresh() {
  const client = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ALERTS_KEY }),
      client.invalidateQueries({ queryKey: WATCHLIST_KEY }),
    ]);
  }, [client]);
}

/**
 * Create (UC-13) or edit an alert. Editing replaces the rule; a TRIGGERED
 * or EXPIRED alert comes back ACTIVE, a PAUSED one stays PAUSED.
 */
export function useSaveAlert() {
  const { alerts } = useServices();
  const refresh = useRefresh();
  return useMutation(
    useCallback(
      async (
        target: { pairId: string } | { alert: Alert },
        rule: AlertRule,
      ) => {
        const saved =
          'alert' in target
            ? await alerts.update(target.alert.id, rule)
            : await alerts.create(target.pairId, rule);
        await refresh();
        return saved;
      },
      [alerts, refresh],
    ),
  );
}

export type AlertAction = 'pause' | 'resume' | 'remove';

/** Pause, resume and delete (UC-14); lists are read again after each answer. */
export function useAlertActions() {
  const { alerts } = useServices();
  const refresh = useRefresh();
  return useMutation(
    useCallback(
      async (action: AlertAction, id: string) => {
        try {
          if (action === 'pause') await alerts.pause(id);
          else if (action === 'resume') await alerts.resume(id);
          else await alerts.remove(id);
        } finally {
          await refresh();
        }
      },
      [alerts, refresh],
    ),
  );
}
