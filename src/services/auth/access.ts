import type { AccountRole, Entitlements, Session } from '../../types/domain';

export function canAccessRole(
  session: Session | null,
  roles: readonly AccountRole[],
): boolean {
  return session?.user.status === 'active' && roles.includes(session.user.role);
}

export function hasEntitlement(
  session: Session | null,
  entitlement: keyof Entitlements,
): boolean {
  return (
    session?.user.status === 'active' &&
    session.entitlements[entitlement] === true
  );
}
