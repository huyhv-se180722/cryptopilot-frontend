import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  LeverageBracketInput,
  PairSettings,
  PairStatus,
} from '../../../types/domain';

export const ADMIN_PAIRS_KEY = ['admin-pairs'] as const;
const LIST_KEY = [...ADMIN_PAIRS_KEY, 'list'] as const;
const BRACKETS_KEY = [...ADMIN_PAIRS_KEY, 'brackets'] as const;
/** The market lists read again after a change, so Traders see it. */
const MARKET_KEY = ['market'] as const;

/** Every pair in display order, searched and filtered by the server (UC-45). */
export function useAdminPairs(q: string, status: PairStatus | null) {
  const { adminPairs } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, q, status],
    queryFn: ({ signal }) =>
      adminPairs.list(
        { ...(q ? { q } : {}), ...(status ? { status } : {}) },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
}

/** The exchange's symbols not yet registered, once two letters are typed. */
export function useExchangeSymbols(q: string) {
  const { adminPairs } = useServices();
  return useQuery({
    queryKey: [...ADMIN_PAIRS_KEY, 'exchange', q],
    queryFn: ({ signal }) => adminPairs.exchangeSymbols(q, signal),
    enabled: q.length >= 2,
  });
}

/** A Futures pair's brackets; read again on each opening (UC-46). */
export function usePairBrackets(pairId: string | null) {
  const { adminPairs } = useServices();
  return useQuery({
    queryKey: [...BRACKETS_KEY, pairId],
    queryFn: ({ signal }) => adminPairs.brackets(pairId as string, signal),
    enabled: pairId !== null,
    staleTime: 0,
  });
}

async function refresh(client: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ADMIN_PAIRS_KEY }),
    client.invalidateQueries({ queryKey: MARKET_KEY }),
  ]);
}

export function useRegisterPair() {
  const { adminPairs } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (symbol: string) => {
        const pair = await adminPairs.register(symbol);
        await refresh(client);
        return pair;
      },
      [adminPairs, client],
    ),
  );
}

export function useUpdatePair() {
  const { adminPairs } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (pairId: string, settings: PairSettings) => {
        const pair = await adminPairs.update(pairId, settings);
        await refresh(client);
        return pair;
      },
      [adminPairs, client],
    ),
  );
}

export function useReplaceBrackets() {
  const { adminPairs } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (pairId: string, brackets: readonly LeverageBracketInput[]) => {
        const saved = await adminPairs.replaceBrackets(pairId, brackets);
        await refresh(client);
        return saved;
      },
      [adminPairs, client],
    ),
  );
}
