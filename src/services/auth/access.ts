import type {
  AccountRole,
  PlanFeature,
  PlanLimit,
  Session,
} from '../../types/domain';

export function canAccessRole(
  session: Session | null,
  roles: readonly AccountRole[],
): boolean {
  return session?.user.status === 'active' && roles.includes(session.user.role);
}

/**
 * - allowed / locked: the plan is known.
 * - unknown: no plan source yet; do not lock up front, the server decides.
 * Gates new actions only — never hide history (AI conversations, videos).
 */
export type FeatureAccess = 'allowed' | 'locked' | 'unknown';

export function featureAccess(
  session: Session | null,
  feature: PlanFeature,
): FeatureAccess {
  if (session?.user.status !== 'active') return 'locked';
  if (session.entitlements === 'unknown') return 'unknown';
  return session.entitlements.features.includes(feature) ? 'allowed' : 'locked';
}

/** null = unlimited, undefined = not known. */
export function planLimit(
  session: Session | null,
  limit: PlanLimit,
): number | null | undefined {
  if (!session || session.entitlements === 'unknown') return undefined;
  return session.entitlements.limits[limit];
}
