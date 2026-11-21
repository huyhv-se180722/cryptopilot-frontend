import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  AdminOrderDetail,
  AdminOrderQuery,
} from '../../../services/api/admin-orders';

export {
  ORDER_GATEWAYS,
  ORDER_STATUSES,
  ORDER_TYPES,
  ORDERS_PAGE_SIZE,
  type AdminOrder,
  type AdminOrderQuery,
} from '../../../services/api/admin-orders';

export const ADMIN_ORDERS_KEY = ['admin-orders'] as const;
const LIST_KEY = [...ADMIN_ORDERS_KEY, 'list'] as const;
const DETAIL_KEY = [...ADMIN_ORDERS_KEY, 'detail'] as const;

/** A page of subscription orders, newest first, filtered by the server (UC-48). */
export function useAdminOrders(query: AdminOrderQuery) {
  const { adminOrders } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, query],
    queryFn: ({ signal }) => adminOrders.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** One order with its gateway answer; read again on each opening. */
export function useAdminOrder(orderCode: string | null) {
  const { adminOrders } = useServices();
  return useQuery({
    queryKey: [...DETAIL_KEY, orderCode],
    queryFn: ({ signal }) => adminOrders.detail(orderCode ?? '', signal),
    enabled: orderCode !== null,
    staleTime: 0,
  });
}

/** The answer of a change replaces the open order; the lists are read again. */
function useSaved() {
  const client = useQueryClient();
  return useCallback(
    async (detail: AdminOrderDetail) => {
      client.setQueryData([...DETAIL_KEY, detail.order.orderCode], detail);
      await client.invalidateQueries({ queryKey: LIST_KEY });
      return detail;
    },
    [client],
  );
}

/** Asks the gateway about an order now (audited by the backend). */
export function useReconcileOrder() {
  const { adminOrders } = useServices();
  const saved = useSaved();
  return useMutation(
    useCallback(
      async (orderCode: string) =>
        saved(await adminOrders.reconcile(orderCode)),
      [adminOrders, saved],
    ),
  );
}

/** Records how a flagged order was handled (audited by the backend). */
export function useMarkOrderHandled() {
  const { adminOrders } = useServices();
  const saved = useSaved();
  return useMutation(
    useCallback(
      async (orderCode: string, note: string) =>
        saved(await adminOrders.markHandled(orderCode, note)),
      [adminOrders, saved],
    ),
  );
}
