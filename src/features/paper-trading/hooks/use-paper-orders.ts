import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { PaperWalletType, PlacePaperOrder } from '../../../types/domain';
import { usePaperAccount } from './use-paper-account';

const PAPER_KEY = ['paper', 'data'] as const;
/** CR-04: 20 rows per page. */
export const PAPER_PAGE_SIZE = 20;
/**
 * The user queue that pushes orders, fills and balances (TR-08) is not
 * built yet, so the open data is read again on this rhythm meanwhile.
 */
export const PAPER_REFRESH_MS = 3_000;

/** Reads run once the demo account is open (the backend answers MSG41 before). */
function useAccountReady() {
  return usePaperAccount().isSuccess;
}

/** One wallet with its balances (TR-04), kept fresh while shown. */
export function usePaperWallet(wallet: PaperWalletType) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'wallet', wallet],
    queryFn: ({ signal }) => paperTrading.getWallet(wallet, signal),
    enabled: useAccountReady(),
    refetchInterval: PAPER_REFRESH_MS,
  });
}

/** Working orders of one pair, or of every pair with null (TR-07). */
export function useOpenOrders(pairId: string | null) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'open', pairId],
    queryFn: ({ signal }) => paperTrading.openOrders(pairId, signal),
    enabled: useAccountReady(),
    refetchInterval: PAPER_REFRESH_MS,
  });
}

const historyQuery = (pairId: string | null, page: number) => ({
  ...(pairId ? { pairId } : {}),
  page,
  pageSize: PAPER_PAGE_SIZE,
});

/** One page of the order history, newest first (read while its tab shows). */
export function useOrderHistory(
  pairId: string | null,
  page: number,
  enabled: boolean,
) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'orders', pairId, page],
    queryFn: ({ signal }) =>
      paperTrading.orders(historyQuery(pairId, page), signal),
    enabled: useAccountReady() && enabled,
    refetchInterval: PAPER_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** One page of the fills (trade history), newest first. */
export function useFillHistory(
  pairId: string | null,
  page: number,
  enabled: boolean,
) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'fills', pairId, page],
    queryFn: ({ signal }) =>
      paperTrading.fills(historyQuery(pairId, page), signal),
    enabled: useAccountReady() && enabled,
    refetchInterval: PAPER_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/**
 * Placing, cancelling and transferring. Never optimistic: balances and
 * order statuses come from the server, read again after each write.
 */
export function usePaperActions() {
  const { paperTrading } = useServices();
  const client = useQueryClient();
  const refresh = useCallback(
    () => client.invalidateQueries({ queryKey: PAPER_KEY }),
    [client],
  );
  const place = useMutation(
    useCallback(
      async (order: PlacePaperOrder) => {
        const placed = await paperTrading.placeOrder(order);
        await refresh();
        return placed;
      },
      [paperTrading, refresh],
    ),
  );
  const cancel = useMutation(
    useCallback(
      async (orderId: string) => {
        try {
          return await paperTrading.cancelOrder(orderId);
        } finally {
          await refresh();
        }
      },
      [paperTrading, refresh],
    ),
  );
  const cancelAll = useMutation(
    useCallback(
      async (pairId: string) => {
        try {
          return await paperTrading.cancelAll(pairId);
        } finally {
          await refresh();
        }
      },
      [paperTrading, refresh],
    ),
  );
  const transfer = useMutation(
    useCallback(
      async (
        from: PaperWalletType,
        amount: string,
        clientTransferId: string,
      ) => {
        const done = await paperTrading.transfer({
          asset: 'USDT',
          from,
          amount,
          clientTransferId,
        });
        await refresh();
        return done;
      },
      [paperTrading, refresh],
    ),
  );
  return { place, cancel, cancelAll, transfer };
}
