import type { AuthState } from '../../services/auth/auth-store';
import type { AccountRole, AccountStatus } from '../../types/domain';

export type AccessRequirement =
  { kind: 'roles'; roles: readonly AccountRole[] } | { kind: 'guest-only' };

export type AccessDecision =
  | { type: 'loading' }
  | { type: 'unavailable' }
  | { type: 'login' }
  | { type: 'blocked'; status: Exclude<AccountStatus, 'active'> }
  | { type: 'denied'; home: string }
  | { type: 'home'; path: string }
  | { type: 'allow' };

/** Landing screen per role after sign-in (SRS 3.2.3: SCR-08 / SCR-33). */
export function homePathFor(role: AccountRole): string {
  return role === 'Admin' ? '/admin' : '/dashboard';
}

/**
 * Client-side route decision (UX only; the backend authorizes every call).
 * Roles have no hierarchy: an Admin is denied Trader routes and vice versa.
 */
export function decideAccess(
  state: AuthState,
  requirement: AccessRequirement,
): AccessDecision {
  if (requirement.kind === 'guest-only') {
    if (state.status === 'loading') return { type: 'loading' };
    // Without a working session check, guests must still reach sign-in.
    if (state.status === 'error' || !state.session) return { type: 'allow' };
    return { type: 'home', path: homePathFor(state.session.user.role) };
  }
  if (state.status === 'loading') return { type: 'loading' };
  if (state.status === 'error') return { type: 'unavailable' };
  const session = state.session;
  if (!session) return { type: 'login' };
  if (session.user.status !== 'active')
    return { type: 'blocked', status: session.user.status };
  if (!requirement.roles.includes(session.user.role))
    return { type: 'denied', home: homePathFor(session.user.role) };
  return { type: 'allow' };
}
