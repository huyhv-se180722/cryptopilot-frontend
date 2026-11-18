import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type { CommunityProfileUpdate } from '../../../types/domain';
import { COMMUNITY_KEY } from './use-community';

const OWN_PROFILE_KEY = [...COMMUNITY_KEY, 'own-profile'] as const;

/**
 * The caller's own profile, read when the Edit dialog of their member page
 * opens (D-99): it carries the image keys that keep the current images.
 */
export function useOwnProfile(enabled: boolean) {
  const { profile } = useServices();
  return useQuery({
    queryKey: OWN_PROFILE_KEY,
    enabled,
    staleTime: 0,
    queryFn: ({ signal }) => profile.get(signal),
  });
}

/**
 * Saves the Edit dialog (D-99); the member page, the cards that show the
 * avatar and the own profile read again.
 */
export function useSaveCommunityProfile() {
  const { profile } = useServices();
  const client = useQueryClient();
  return useMutation(
    useCallback(
      async (update: CommunityProfileUpdate) => {
        await profile.updateCommunityProfile(update);
        await client.invalidateQueries({ queryKey: COMMUNITY_KEY });
      },
      [profile, client],
    ),
  );
}

/** Uploads one avatar or banner and answers its key (D-98, D-99). */
export function useUploadProfileImage() {
  const { profile } = useServices();
  return useMutation(
    useCallback(
      (file: File, onProgress?: (share: number) => void) =>
        profile.uploadProfileImage(file, onProgress),
      [profile],
    ),
  );
}
