import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { AiConfigurationDraft } from '../../../types/domain';

const CONFIGURATIONS_KEY = ['ai-admin', 'configurations'] as const;

/** Every AI configuration version, the newest first (SCR-42). */
export function useAiConfigurations() {
  const { aiAdmin } = useServices();
  return useQuery({
    queryKey: CONFIGURATIONS_KEY,
    queryFn: ({ signal }) => aiAdmin.list(signal),
  });
}

/** Adds an inactive version (UC-50). */
export function useCreateAiConfiguration() {
  const { aiAdmin } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (draft: AiConfigurationDraft) => {
        const created = await aiAdmin.create(draft);
        await client.invalidateQueries({ queryKey: CONFIGURATIONS_KEY });
        return created;
      },
      [aiAdmin, client],
    ),
  );
}

/** Makes a version the active one; the previous one is deactivated (UC-50). */
export function useActivateAiConfiguration() {
  const { aiAdmin } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (id: string) => {
        const activated = await aiAdmin.activate(id);
        await client.invalidateQueries({ queryKey: CONFIGURATIONS_KEY });
        return activated;
      },
      [aiAdmin, client],
    ),
  );
}
