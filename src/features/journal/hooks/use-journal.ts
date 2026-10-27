import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import type { PositionStatus } from '../../../types/domain';

/** CR-04: the journal column shows 10 trades a page. */
export const JOURNAL_PAGE_SIZE = 10;

/**
 * How often the journal is read again while a trade is OPEN: an exit by
 * take profit, stop loss or liquidation is decided on the server and the
 * guide documents no push of it to the list (CR-09).
 */
export const JOURNAL_REFRESH_MS = 30_000;

export interface JournalFilter {
  status?: PositionStatus;
  pairId?: string;
  page: number;
}

/**
 * One page of the Trader's journal (SCR-20). The key sits under the plan
 * list's, so every save, activation or close of a plan, which invalidates
 * `['plans', 'list']`, reads the journal again too.
 */
export function useJournal({ status, pairId, page }: JournalFilter) {
  const { journal } = useServices();
  return useQuery({
    queryKey: ['plans', 'list', 'journal', { status, pairId, page }],
    queryFn: ({ signal }) =>
      journal.list(
        {
          page,
          pageSize: JOURNAL_PAGE_SIZE,
          ...(status ? { status } : {}),
          ...(pairId ? { pairId } : {}),
        },
        signal,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((trade) => trade.status === 'OPEN')
        ? JOURNAL_REFRESH_MS
        : false,
  });
}
