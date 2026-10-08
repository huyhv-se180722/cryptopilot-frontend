import type { PlanFeature, PlanLimit } from '../types/domain';
import { featureAccess, planLimit } from '../services/auth/access';
import { useAuth } from './use-auth';

/** Gate new paid actions, not access to previously created history. */
export function useFeature(feature: PlanFeature) {
  return featureAccess(useAuth().session, feature);
}

export function usePlanLimit(limit: PlanLimit) {
  return planLimit(useAuth().session, limit);
}

export function usePlanTier() {
  const entitlements = useAuth().session?.entitlements;
  return entitlements && entitlements !== 'unknown'
    ? entitlements.tier
    : undefined;
}
