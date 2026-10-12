import { QueryClient } from '@tanstack/react-query';

/**
 * Server-state cache (ADR-016). No automatic retry: the failures the API
 * answers (MSG41, NOT_CONFIGURED, MSG50) do not change on a retry, and
 * MSG50 asks the client not to retry at all (ADR-014). Screens refetch on
 * their own schedule, not on window focus.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
