import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';
import { usePaperAccount } from './use-paper-account';
import { PAPER_KEY } from './use-paper-orders';

/** Holdings are valued at the current last price, which keeps moving. */
export const PNL_REFRESH_MS = 10_000;
/** The day's worth moves with the prices too, the history only daily. */
export const EQUITY_REFRESH_MS = 30_000;

/** Each Spot coin's cost, value and unrealised PnL (TR-13). */
export function useSpotPnl() {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'pnl'],
    queryFn: ({ signal }) => paperTrading.spotPnl(signal),
    enabled: usePaperAccount().isSuccess,
    refetchInterval: PNL_REFRESH_MS,
  });
}

/** The account's worth now and at the start of each of the last `days`. */
export function usePaperEquity(days: number) {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: [...PAPER_KEY, 'equity', days],
    queryFn: ({ signal }) => paperTrading.equity(days, signal),
    enabled: usePaperAccount().isSuccess,
    refetchInterval: EQUITY_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}
