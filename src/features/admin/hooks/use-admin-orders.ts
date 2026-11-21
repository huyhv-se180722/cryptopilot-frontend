import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { AdminOrderDetail, AdminOrderQuery } from '../../../types/domain';

const KEY = ['admin', 'orders'] as const;
const detailKey = (code: string) => [...KEY, 'detail', code] as const;

/** One page of subscription orders, newest first (SCR-40). */
export function useAdminOrders(query: AdminOrderQuery) {
  const { adminOrders } = useServices();
  return useQuery({
    queryKey: [...KEY, 'list', query],
    queryFn: ({ signal }) => adminOrders.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** One order with its gateway data, read while its dialog is open. */
export function useAdminOrder(code: string | null) {
  const { adminOrders } = useServices();
  return useQuery({
    queryKey: detailKey(code ?? ''),
    queryFn: ({ signal }) => adminOrders.get(code ?? '', signal),
    enabled: code !== null,
  });
}

/** Keeps the answered order and reads the list again. */
function useSettle() {
  const client = useQueryClient();
  return (detail: AdminOrderDetail) => {
    client.setQueryData(detailKey(detail.order.orderCode), detail);
    void client.invalidateQueries({ queryKey: [...KEY, 'list'] });
  };
}

/** Asks the gateway about a PENDING order now (NSF-13, audited). */
export function useReconcileOrder() {
  const { adminOrders } = useServices();
  const settle = useSettle();
  return useMutation({
    mutationFn: (code: string) => adminOrders.reconcile(code),
    onSuccess: settle,
  });
}

/** Records how a flagged order was handled (BR-63, audited). */
export function useMarkOrderHandled() {
  const { adminOrders } = useServices();
  const settle = useSettle();
  return useMutation({
    mutationFn: ({ code, note }: { code: string; note: string }) =>
      adminOrders.markHandled(code, note),
    onSuccess: settle,
  });
}
