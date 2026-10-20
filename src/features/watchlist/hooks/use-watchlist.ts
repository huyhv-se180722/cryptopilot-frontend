import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import { problemOf } from '../../../services/api/errors';
import type {
  SetupScore,
  WatchlistItem,
  WatchlistItemUpdate,
} from '../../../types/domain';

export const WATCHLIST_KEY = ['watchlist'] as const;

/** The Trader's whole watchlist with the plan's limit (SCR-12). */
export function useWatchlist() {
  const { watchlist } = useServices();
  return useQuery({
    queryKey: WATCHLIST_KEY,
    queryFn: ({ signal }) => watchlist.get(signal),
  });
}

/**
 * The watchlist row of a pair: null when the pair is not watched,
 * undefined while the list is unknown.
 */
export function useWatchedPair(
  symbol: string,
): WatchlistItem | null | undefined {
  const list = useWatchlist();
  if (!list.data) return undefined;
  return list.data.items.find((item) => item.symbol === symbol) ?? null;
}

/**
 * Adds a pair by its market list id (UC-12) and reads the list again.
 * The server refuses a watched pair (MSG45) and a full list (MSG27, BR-15).
 */
export function useAddToWatchlist() {
  const { watchlist } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (pairId: string) => {
        const item = await watchlist.add(pairId);
        await client.invalidateQueries({ queryKey: WATCHLIST_KEY });
        return item;
      },
      [watchlist, client],
    ),
  );
}

/** Rows read at most this many at a time (120 API calls a minute, D-82). */
const SCORE_CONCURRENCY = 4;

/**
 * The setup score of each Spot row (SRS 3.4.1), read once per visit from
 * `GET /analysis/spot/{symbol}`: the row has none (M-08). The score is on
 * the Trader's preset timeframe, which the analysis decides. A failed read
 * leaves that row empty.
 */
export function useWatchlistScores(symbols: readonly string[]) {
  const { analysis } = useServices();
  return useQuery({
    queryKey: [...WATCHLIST_KEY, 'scores', symbols],
    enabled: symbols.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const scores = new Map<string, SetupScore>();
      const queue = [...symbols];
      const worker = async () => {
        for (let symbol = queue.shift(); symbol; symbol = queue.shift()) {
          try {
            const result = await analysis.get('spot', symbol, '1h', signal);
            scores.set(symbol, result.setupScore);
          } catch {
            if (signal.aborted) return;
          }
        }
      };
      await Promise.all(
        Array.from({ length: SCORE_CONCURRENCY }, () => worker()),
      );
      return scores as ReadonlyMap<string, SetupScore>;
    },
  });
}

/**
 * The alert count of a MSG26 refusal (every alert of the row, D-76), to
 * show in the confirmation and send back; null for any other answer.
 */
export function confirmationCount(error: unknown): number | null {
  const problem = problemOf(error);
  if (problem?.messageCode !== 'MSG26') return null;
  const count = Number(problem.messageArgs[1]);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

/** The positions that changed when `ordered` replaces the current order. */
export function reorderUpdates(
  current: readonly WatchlistItem[],
  ordered: readonly string[],
): { id: string; sortOrder: number }[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  return ordered.flatMap((id, index) =>
    byId.get(id)?.sortOrder === index ? [] : [{ id, sortOrder: index }],
  );
}

/**
 * Edit, reorder and remove rows (UC-12). Reordering PATCHes every row whose
 * position changed (0…n−1; the server never renumbers) and reads the list
 * again. Removal is refused with MSG26 while the row has alerts and the
 * Trader has not confirmed the server's count (D-76).
 */
export function useWatchlistActions() {
  const { watchlist } = useServices();
  const client = useQueryClient();
  const refresh = useCallback(
    () => client.invalidateQueries({ queryKey: WATCHLIST_KEY }),
    [client],
  );
  const edit = useMutation(
    useCallback(
      async (id: string, update: WatchlistItemUpdate) => {
        const item = await watchlist.update(id, update);
        await refresh();
        return item;
      },
      [watchlist, refresh],
    ),
  );
  const reorder = useMutation(
    useCallback(
      async (current: readonly WatchlistItem[], ordered: readonly string[]) => {
        try {
          for (const { id, sortOrder } of reorderUpdates(current, ordered))
            await watchlist.update(id, { sortOrder });
        } finally {
          await refresh();
        }
      },
      [watchlist, refresh],
    ),
  );
  const removal = useMutation(
    useCallback(
      async (id: string, confirmedAlerts?: number) => {
        await watchlist.remove(id, confirmedAlerts);
        await refresh();
        void client.invalidateQueries({ queryKey: ['alerts'] });
      },
      [watchlist, refresh, client],
    ),
  );
  return { edit, reorder, removal };
}
