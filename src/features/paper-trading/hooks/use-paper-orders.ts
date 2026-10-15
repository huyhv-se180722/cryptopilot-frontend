import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  PaperLedgerQuery,
  PaperOrderStatus,
  PaperWalletType,
  PlacePaperOrder,
  PlacePaperOrderList,
} from '../../../types/domain';
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

/** Filters of the order and trade histories; absent means every value. */
export interface HistoryFilter {
  pairId: string | null;
  /** Order history only. */
  status?: PaperOrderStatus | undefined;
  /** Placed / traded at or after, ISO 8601 UTC. */
  from?: string | undefined;
}

const historyQuery = (filter: HistoryFilter, page: number) => ({
  ...(filter.pairId ? { pairId: filter.pairId } : {}),
  ...(filter.status ? { status: filter.status } : {}),
  ...(filter.from ? { from: filter.from } : {}),
  page,
  pageSize: PAPER_PAGE_SIZE,
});

/** One page of the order history, newest first (read while it shows). */
export function useOrderHistory(
  filter: HistoryFilter,
  page: number,
  enabled: boolean,
) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'orders', filter, page],
    queryFn: ({ signal }) =>
      paperTrading.orders(historyQuery(filter, page), signal),
    enabled: useAccountReady() && enabled,
    refetchInterval: PAPER_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** One page of the fills (trade history), newest first. */
export function useFillHistory(
  filter: HistoryFilter,
  page: number,
  enabled: boolean,
) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'fills', filter, page],
    queryFn: ({ signal }) =>
      paperTrading.fills(
        historyQuery({ ...filter, status: undefined }, page),
        signal,
      ),
    enabled: useAccountReady() && enabled,
    refetchInterval: PAPER_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** One page of the transaction history (every balance change), newest first. */
export function useLedger(query: PaperLedgerQuery, enabled: boolean) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'ledger', query],
    queryFn: ({ signal }) => paperTrading.ledger(query, signal),
    enabled: useAccountReady() && enabled,
    refetchInterval: PAPER_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** One page of the transfers between the wallets, newest first. */
export function useTransfers(page: number, enabled: boolean) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'transfers', page],
    queryFn: ({ signal }) =>
      paperTrading.transfers({ page, pageSize: PAPER_PAGE_SIZE }, signal),
    enabled: useAccountReady() && enabled,
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
  const placeList = useMutation(
    useCallback(
      async (list: PlacePaperOrderList) => {
        const placed = await paperTrading.placeOrderList(list);
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
  return { place, placeList, cancel, cancelAll, transfer };
}
