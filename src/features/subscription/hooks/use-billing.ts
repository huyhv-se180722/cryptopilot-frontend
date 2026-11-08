import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  PaymentGatewayCode,
  SubscriptionOrder,
} from '../../../types/domain';

export const BILLING_KEY = ['billing'] as const;
/** SCR-31 asks for the result this often, for at most `POLL_LIMIT_MS`. */
export const POLL_EVERY_MS = 5_000;
export const POLL_LIMIT_MS = 120_000;

export function usePackages() {
  const { subscription } = useServices();
  return useQuery({
    queryKey: [...BILLING_KEY, 'packages'],
    queryFn: ({ signal }) => subscription.packages(signal),
  });
}

export function useGateways() {
  const { subscription } = useServices();
  return useQuery({
    queryKey: [...BILLING_KEY, 'gateways'],
    queryFn: ({ signal }) => subscription.gateways(signal),
  });
}

export function useCurrentSubscription() {
  const { subscription } = useServices();
  return useQuery({
    queryKey: [...BILLING_KEY, 'current'],
    queryFn: ({ signal }) => subscription.current(signal),
  });
}

export function useOrders(page: number, pageSize: number) {
  const { subscription } = useServices();
  return useQuery({
    queryKey: [...BILLING_KEY, 'orders', page, pageSize],
    queryFn: ({ signal }) => subscription.orders({ page, pageSize }, signal),
  });
}

/**
 * One order, read again every 5 s while it is PENDING and `polling` holds
 * (SCR-31); a settled order is not asked for again.
 */
export function useOrder(orderCode: string | null, polling: boolean) {
  const { subscription } = useServices();
  return useQuery({
    queryKey: [...BILLING_KEY, 'order', orderCode],
    queryFn: ({ signal }) => subscription.order(orderCode ?? '', signal),
    enabled: orderCode !== null && orderCode !== '',
    refetchInterval: (query) =>
      polling && isOpen(query.state.data) ? POLL_EVERY_MS : false,
  });
}

function isOpen(order: SubscriptionOrder | undefined) {
  return order === undefined || order.status === 'PENDING';
}

export function useQuote() {
  const { subscription } = useServices();
  return useMutation(
    useCallback((code: string) => subscription.quote(code), [subscription]),
  );
}

export function useCreateOrder() {
  const { subscription } = useServices();
  return useMutation(
    useCallback(
      (code: string, gateway: PaymentGatewayCode) =>
        subscription.createOrder(code, gateway),
      [subscription],
    ),
  );
}
