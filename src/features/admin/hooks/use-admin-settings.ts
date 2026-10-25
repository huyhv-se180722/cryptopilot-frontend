import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { AdminSettingService } from '../../../services/api/contracts';
import type { SystemSetting } from '../../../types/domain';

export const ADMIN_SETTINGS_KEY = ['admin-settings'] as const;

/** Every system setting with its range (UC-51); read again on each visit. */
export function useAdminSettings() {
  const { adminSettings } = useServices();
  return useQuery({
    queryKey: ADMIN_SETTINGS_KEY,
    queryFn: ({ signal }) => adminSettings.list(signal),
    staleTime: 0,
  });
}

export interface SaveOutcome {
  saved: SystemSetting[];
  /** The values refused, by key, with the server's error. */
  refused: { key: string; error: unknown }[];
}

/**
 * Sends the values one key at a time. A value refused while another is
 * still to be saved is sent once more after them: two bounds kept in
 * order (BR-69) may only fit once the other has moved.
 */
export async function saveInTurn(
  service: AdminSettingService,
  values: readonly { key: string; value: string }[],
): Promise<SaveOutcome> {
  const saved: SystemSetting[] = [];
  let pending = [...values];
  let refused: SaveOutcome['refused'] = [];
  for (let round = 0; round < 2 && pending.length; round++) {
    refused = [];
    for (const each of pending) {
      try {
        saved.push(await service.update(each.key, each.value));
      } catch (error) {
        refused.push({ key: each.key, error });
      }
    }
    if (refused.length === pending.length) break;
    pending = values.filter((each) =>
      refused.some((failed) => failed.key === each.key),
    );
  }
  return { saved, refused };
}

export function useSaveSettings() {
  const { adminSettings } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (values: readonly { key: string; value: string }[]) => {
        const outcome = await saveInTurn(adminSettings, values);
        if (outcome.saved.length)
          await client.invalidateQueries({ queryKey: ADMIN_SETTINGS_KEY });
        return outcome;
      },
      [adminSettings, client],
    ),
  );
}
