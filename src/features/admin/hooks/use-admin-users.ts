import { useCallback } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  AccountAction,
  AccountRole,
  AdminUserDetail,
  AdminUserQuery,
} from '../../../types/domain';

export const ADMIN_USERS_KEY = ['admin-users'] as const;
const LIST_KEY = [...ADMIN_USERS_KEY, 'list'] as const;
const DETAIL_KEY = [...ADMIN_USERS_KEY, 'detail'] as const;

/** A page of accounts, newest first, searched and filtered by the server (UC-42). */
export function useAdminUsers(query: AdminUserQuery) {
  const { adminUsers } = useServices();
  return useQuery({
    queryKey: [...LIST_KEY, query],
    queryFn: ({ signal }) => adminUsers.search(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** One account with its activity and latest audit; read again on each opening. */
export function useAdminUser(userId: string) {
  const { adminUsers } = useServices();
  return useQuery({
    queryKey: [...DETAIL_KEY, userId],
    queryFn: ({ signal }) => adminUsers.get(userId, signal),
    staleTime: 0,
  });
}

/**
 * The answer of a change is the account as saved: it replaces the open
 * account at once and the lists are read again.
 */
function useSaved() {
  const client = useQueryClient();
  return useCallback(
    async (detail: AdminUserDetail) => {
      client.setQueryData([...DETAIL_KEY, detail.account.userId], detail);
      await client.invalidateQueries({ queryKey: LIST_KEY });
      return detail;
    },
    [client],
  );
}

export function useAccountAction() {
  const { adminUsers } = useServices();
  const saved = useSaved();
  return useMutation(
    useCallback(
      async (userId: string, action: AccountAction, reason: string) =>
        saved(await adminUsers.act(userId, action, reason)),
      [adminUsers, saved],
    ),
  );
}

export function useChangeRole() {
  const { adminUsers } = useServices();
  const saved = useSaved();
  return useMutation(
    useCallback(
      async (userId: string, role: AccountRole, reason: string) =>
        saved(await adminUsers.changeRole(userId, role, reason)),
      [adminUsers, saved],
    ),
  );
}
