import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../../../hooks/use-mutation';
import { useServices } from '../../../hooks/use-services';
import type {
  RiskProfileParams,
  RiskQuestion,
  UserProfile,
} from '../../../types/domain';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown };

/**
 * One read with cancellation; `reload` re-reads after a `/me/*` write
 * (fe-guide: invalidate the "me" query). Stale responses are discarded.
 */
function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, enabled = true) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      },
    );
    return () => controller.abort();
  }, [load, version, enabled]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // A reload keeps the previous data on screen until the new answer lands.
  return { state, reload };
}

export interface ProfileData {
  profile: UserProfile;
  risk: RiskProfileParams;
}

/** Profile and risk profile of the signed-in Trader (SCR-07). */
export function useProfileData() {
  const { profile } = useServices();
  const load = useCallback(
    async (signal: AbortSignal): Promise<ProfileData> => {
      const [data, risk] = await Promise.all([
        profile.get(signal),
        profile.getRiskProfile(signal),
      ]);
      return { profile: data, risk };
    },
    [profile],
  );
  return useLoad(load);
}

/** The questionnaire is static for version 1; read it when first opened. */
export function useRiskQuestionnaire(enabled: boolean) {
  const { profile } = useServices();
  const load = useCallback(
    (signal: AbortSignal): Promise<readonly RiskQuestion[]> =>
      profile.getQuestionnaire(signal),
    [profile],
  );
  return useLoad(load, enabled);
}

export function useUpdateProfile() {
  return useMutation(useServices().profile.update);
}
export function useUpdateNotifications() {
  return useMutation(useServices().profile.updateNotifications);
}
export function useChooseRiskProfile() {
  return useMutation(useServices().profile.chooseRiskProfile);
}
export function useSuggestRiskProfile() {
  return useMutation(useServices().profile.suggestRiskProfile);
}
