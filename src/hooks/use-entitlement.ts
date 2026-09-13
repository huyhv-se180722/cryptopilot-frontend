import type { Entitlements } from '../types/domain';
import { hasEntitlement } from '../services/auth/access';
import { useAuth } from './use-auth';

/** Gate new paid actions, not access to previously created history. */
export function useEntitlement(entitlement: keyof Entitlements): boolean {
  return hasEntitlement(useAuth().session, entitlement);
}
