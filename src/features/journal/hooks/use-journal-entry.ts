import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import { problemOf } from '../../../services/api/errors';
import type {
  JournalEntry,
  JournalReview,
  ManualTradeInput,
} from '../../../types/domain';

/**
 * Under the plan list's key, as the journal list: a plan event that
 * invalidates `['plans', 'list']` reads the trade again too.
 */
const entryKey = (id: string) =>
  ['plans', 'list', 'journal', 'entry', id] as const;
const LIST_KEY = ['plans', 'list'] as const;

/**
 * One trade with its review and learning data (SCR-21). `missing` tells a
 * trade that is not the caller's (404, MSG41) from a failed read.
 */
export function useJournalEntry(id: string) {
  const { journal } = useServices();
  const query = useQuery({
    queryKey: entryKey(id),
    queryFn: ({ signal }) => journal.get(id, signal),
    enabled: id !== '',
    retry: (count, error) =>
      problemOf(error)?.code !== 'RESOURCE_NOT_FOUND' && count < 2,
  });
  return {
    ...query,
    missing: problemOf(query.error)?.code === 'RESOURCE_NOT_FOUND',
  };
}

/** The strategies a trade can carry; they change rarely. */
export function useStrategies() {
  const { journal } = useServices();
  return useQuery({
    queryKey: ['strategies'],
    queryFn: ({ signal }) => journal.strategies(signal),
    staleTime: 10 * 60_000,
  });
}

/**
 * Keeps the answered trade and reads the lists again, not the trade
 * itself: the answer already is its new state.
 */
function useSettle() {
  const client = useQueryClient();
  return (entry: JournalEntry) => {
    const key = entryKey(entry.trade.id);
    client.setQueryData(key, entry);
    void client.invalidateQueries({
      queryKey: LIST_KEY,
      predicate: (query) =>
        !(query.queryKey[3] === key[3] && query.queryKey[4] === key[4]),
    });
  };
}

/** UC-23: saves the review of a trade. */
export function useSaveReview(id: string) {
  const { journal } = useServices();
  const settle = useSettle();
  return useMutation({
    mutationFn: (review: JournalReview) => journal.review(id, review),
    onSuccess: settle,
  });
}

/** Uploads a chart image and resolves with its storage key (MSG32 on refusal). */
export function useUploadChartImage(id: string) {
  const { journal } = useServices();
  return useMutation({
    mutationFn: ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (share: number) => void;
    }) => journal.uploadChartImage(id, file, onProgress),
  });
}

/** UC-24: records a manual trade, or replaces one when `id` is given. */
export function useSaveManualTrade(id: string | null) {
  const { journal } = useServices();
  const settle = useSettle();
  return useMutation({
    mutationFn: (input: ManualTradeInput) =>
      id === null ? journal.record(input) : journal.edit(id, input),
    onSuccess: settle,
  });
}

/** UC-24: deletes a manual trade with its image. */
export function useDeleteManualTrade(id: string) {
  const { journal } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => journal.remove(id),
    onSuccess: () => {
      client.removeQueries({ queryKey: entryKey(id) });
      void client.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
