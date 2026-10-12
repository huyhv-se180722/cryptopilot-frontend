import { useQuery } from '@tanstack/react-query';
import { useServices } from '../../../hooks/use-services';

/**
 * The Trader's paper account, opened on entering the trading screens as
 * the backend expects (TR-04: idempotent, so a repeat is harmless). The
 * account never changes on its own, so it is read once per session.
 */
export function usePaperAccount() {
  const { paperTrading } = useServices();
  return useQuery({
    queryKey: ['paper', 'account'],
    queryFn: ({ signal }) => paperTrading.openAccount(signal),
    staleTime: Infinity,
  });
}
