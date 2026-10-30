import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { FuturesHistoryQuery } from '../../../services/api/futures';
import type {
  FuturesAccountEvent,
  MarginType,
  PlaceFuturesAlgoOrder,
  PlaceFuturesOrder,
  PositionSide,
} from '../../../types/futures';
import type { Decimal } from '../../../types/domain';
import { usePaperAccount } from '../../paper-trading/hooks/use-paper-account';

export const FUTURES_KEY = ['paper', 'futures'] as const;
/** While the account's pushes do not arrive, the open data is read on this rhythm. */
export const FUTURES_REFRESH_MS = 3_000;
const PUSH_SETTLE_MS = 150;

/** Reads run once the demo account is open (the backend answers MSG41 before). */
function useReady() {
  return usePaperAccount().isSuccess;
}

/** None while the pushes arrive, else `FUTURES_REFRESH_MS`. */
function useRefresh(): number | false {
  const { paperTrading } = useServices();
  const status = useSyncExternalStore(
    paperTrading.onAccountFeedStatus,
    paperTrading.accountFeedStatus,
    paperTrading.accountFeedStatus,
  );
  return status === 'open' ? false : FUTURES_REFRESH_MS;
}

/** The reads a push makes stale, by what it changed. */
const STALE: Record<FuturesAccountEvent['kind'], readonly string[]> = {
  order: ['orders', 'positions', 'account', 'history'],
  algo: ['algo', 'history'],
  account: ['account', 'positions'],
  config: ['config', 'positions'],
  marginCall: ['account', 'positions'],
};

/**
 * Follows the Trader's Futures queues (TR-41, TR-43): each push reads again
 * what it changed, pushes close together in one go, every read once the
 * connection opens again; a margin call is handed to `onMarginCall`.
 */
export function useFuturesPush(
  onMarginCall?: (
    event: Extract<FuturesAccountEvent, { kind: 'marginCall' }>,
  ) => void,
) {
  const { futuresTrading, paperTrading } = useServices();
  const client = useQueryClient();
  const ready = useReady();
  useEffect(() => {
    if (!ready) return;
    let stale = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      timer = undefined;
      const parts = stale;
      stale = new Set();
      parts.forEach(
        (part) =>
          void client.invalidateQueries({ queryKey: [...FUTURES_KEY, part] }),
      );
    };
    const stop = futuresTrading.subscribe((event) => {
      STALE[event.kind].forEach((part) => stale.add(part));
      if (event.kind === 'marginCall') onMarginCall?.(event);
      timer ??= setTimeout(flush, PUSH_SETTLE_MS);
    });
    let open = paperTrading.accountFeedStatus() === 'open';
    const stopStatus = paperTrading.onAccountFeedStatus(() => {
      const now = paperTrading.accountFeedStatus() === 'open';
      if (now && !open)
        void client.invalidateQueries({ queryKey: FUTURES_KEY });
      open = now;
    });
    return () => {
      stop();
      stopStatus();
      if (timer) clearTimeout(timer);
    };
  }, [ready, futuresTrading, paperTrading, client, onMarginCall]);
}

export function useFuturesAccount() {
  const { futuresTrading } = useServices();
  return useQuery({
    queryKey: [...FUTURES_KEY, 'account'],
    queryFn: ({ signal }) => futuresTrading.account(signal),
    enabled: useReady(),
    refetchInterval: useRefresh(),
  });
}

/** Open positions; uPnL and margin ratio move with the mark, so they are read often. */
export function useFuturesPositions(symbol: string | null) {
  const { futuresTrading } = useServices();
  return useQuery({
    queryKey: [...FUTURES_KEY, 'positions', symbol],
    queryFn: ({ signal }) => futuresTrading.positions(symbol, signal),
    enabled: useReady(),
    refetchInterval: FUTURES_REFRESH_MS,
  });
}

export function useFuturesOpenOrders(symbol: string | null) {
  const { futuresTrading } = useServices();
  return useQuery({
    queryKey: [...FUTURES_KEY, 'orders', symbol],
    queryFn: ({ signal }) => futuresTrading.openOrders(symbol, signal),
    enabled: useReady(),
    refetchInterval: useRefresh(),
  });
}

export function useFuturesOpenAlgoOrders(symbol: string | null) {
  const { futuresTrading } = useServices();
  return useQuery({
    queryKey: [...FUTURES_KEY, 'algo', symbol],
    queryFn: ({ signal }) => futuresTrading.openAlgoOrders(symbol, signal),
    enabled: useReady(),
    refetchInterval: useRefresh(),
  });
}

export function useFuturesSymbolConfig(symbol: string) {
  const { futuresTrading } = useServices();
  return useQuery({
    queryKey: [...FUTURES_KEY, 'config', 'symbol', symbol],
    queryFn: ({ signal }) => futuresTrading.symbolConfig(symbol, signal),
    enabled: useReady(),
  });
}

export function useFuturesPositionMode() {
  const { futuresTrading } = useServices();
  return useQuery({
    queryKey: [...FUTURES_KEY, 'config', 'mode'],
    queryFn: ({ signal }) => futuresTrading.positionMode(signal),
    enabled: useReady(),
  });
}

export function useFuturesBrackets(symbol: string) {
  const { futuresTrading } = useServices();
  return useQuery({
    queryKey: [...FUTURES_KEY, 'brackets', symbol],
    queryFn: ({ signal }) => futuresTrading.brackets(symbol, signal),
    staleTime: 5 * 60_000,
  });
}

/** One history list, read while its tab is shown. */
export function useFuturesHistory<T>(
  kind: 'orders' | 'trades' | 'algo' | 'income' | 'positions',
  query: FuturesHistoryQuery,
  enabled: boolean,
  read: (query: FuturesHistoryQuery, signal: AbortSignal) => Promise<T>,
) {
  return useQuery({
    queryKey: [...FUTURES_KEY, 'history', kind, query],
    queryFn: ({ signal }) => read(query, signal),
    enabled: useReady() && enabled,
  });
}

/** The changes of the Futures screen; each reads again what it changed. */
export function useFuturesActions() {
  const { futuresTrading: f } = useServices();
  const client = useQueryClient();
  const ops = useMemo(() => {
    const after =
      <A extends unknown[], T>(
        operation: (...args: A) => Promise<T>,
        ...parts: string[]
      ) =>
      async (...args: A) => {
        const result = await operation(...args);
        parts.forEach(
          (part) =>
            void client.invalidateQueries({ queryKey: [...FUTURES_KEY, part] }),
        );
        return result;
      };
    const trading = ['orders', 'positions', 'account', 'history', 'algo'];
    return {
      place: after(
        (order: PlaceFuturesOrder) => f.placeOrder(order),
        ...trading,
      ),
      placeAlgo: after(
        (order: PlaceFuturesAlgoOrder) => f.placeAlgoOrder(order),
        'algo',
        'history',
      ),
      amend: after(
        (amend: Parameters<typeof f.amendOrder>[0]) => f.amendOrder(amend),
        ...trading,
      ),
      cancel: after(
        (symbol: string, orderId: string) => f.cancelOrder(symbol, orderId),
        ...trading,
      ),
      cancelAll: after(
        (symbol: string) => f.cancelAllOrders(symbol),
        ...trading,
      ),
      cancelAlgo: after(
        (symbol: string, algoId: string) => f.cancelAlgoOrder(symbol, algoId),
        'algo',
        'history',
      ),
      leverage: after(
        (symbol: string, leverage: number, marginType: MarginType) =>
          f.changeLeverage(symbol, leverage, marginType),
        'config',
        'positions',
        'account',
      ),
      marginType: after(
        (symbol: string, marginType: MarginType) =>
          f.changeMarginType(symbol, marginType),
        'config',
        'positions',
        'account',
      ),
      positionMode: after(
        (dual: boolean) => f.changePositionMode(dual),
        'config',
        'positions',
      ),
      adjustMargin: after(
        (change: {
          symbol: string;
          positionSide: PositionSide;
          amount: Decimal;
          type: 1 | 2;
        }) => f.adjustMargin(change),
        'positions',
        'account',
        'history',
      ),
      close: after(
        (close: Parameters<typeof f.closePosition>[0]) =>
          f.closePosition(close),
        ...trading,
      ),
    };
  }, [f, client]);
  return {
    place: useMutation(ops.place),
    placeAlgo: useMutation(ops.placeAlgo),
    amend: useMutation(ops.amend),
    cancel: useMutation(ops.cancel),
    cancelAll: useMutation(ops.cancelAll),
    cancelAlgo: useMutation(ops.cancelAlgo),
    leverage: useMutation(ops.leverage),
    marginType: useMutation(ops.marginType),
    positionMode: useMutation(ops.positionMode),
    adjustMargin: useMutation(ops.adjustMargin),
    close: useMutation(ops.close),
  };
}
