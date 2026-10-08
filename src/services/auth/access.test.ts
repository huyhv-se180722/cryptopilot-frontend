import { describe, expect, it } from 'vitest';
import type { PlanEntitlements, Session } from '../../types/domain';
import { canAccessRole, featureAccess, planLimit } from './access';

/** Test-only plans, never imported by application modules. */
const free: PlanEntitlements = {
  tier: 'FREE',
  features: [],
  limits: { WATCHLIST_MAX: 5, AI_CHAT_DAILY: 0 },
};
const pro: PlanEntitlements = {
  tier: 'PRO',
  features: ['FUTURES_ANALYSIS', 'SCORE_COMPONENTS'],
  limits: { WATCHLIST_MAX: 50, ACTIVE_PLAN_MAX: null },
};
function session(entitlements: Session['entitlements']): Session {
  return {
    user: {
      id: 'test-user',
      email: 'trader@example.test',
      displayName: 'Test trader',
      role: 'Trader',
      status: 'active',
    },
    entitlements,
  };
}

describe('role access', () => {
  it('blocks guests and other roles', () => {
    expect(canAccessRole(null, ['Trader'])).toBe(false);
    expect(canAccessRole(session(free), ['Admin'])).toBe(false);
    expect(canAccessRole(session(free), ['Trader'])).toBe(true);
  });
  it('blocks locked and banned accounts regardless of role or plan', () => {
    for (const status of ['locked', 'banned'] as const) {
      const base = session(pro);
      const blocked = { ...base, user: { ...base.user, status } };
      expect(canAccessRole(blocked, ['Trader'])).toBe(false);
      expect(featureAccess(blocked, 'FUTURES_ANALYSIS')).toBe('locked');
    }
  });
});

describe('plan tier gates (ADR-009)', () => {
  it('locks features the tier lacks and allows those it includes', () => {
    expect(featureAccess(session(free), 'FUTURES_ANALYSIS')).toBe('locked');
    expect(featureAccess(session(pro), 'FUTURES_ANALYSIS')).toBe('allowed');
    expect(featureAccess(session(pro), 'VIDEO_POST')).toBe('locked');
  });
  it('does not lock up front while the plan is unknown', () => {
    expect(featureAccess(session('unknown'), 'SCORE_COMPONENTS')).toBe(
      'unknown',
    );
    expect(planLimit(session('unknown'), 'WATCHLIST_MAX')).toBeUndefined();
  });
  it('reports limits, unlimited as null and unreported as undefined', () => {
    expect(planLimit(session(free), 'WATCHLIST_MAX')).toBe(5);
    expect(planLimit(session(free), 'AI_CHAT_DAILY')).toBe(0);
    expect(planLimit(session(pro), 'ACTIVE_PLAN_MAX')).toBeNull();
    expect(planLimit(session(pro), 'ACTIVE_ALERT_MAX')).toBeUndefined();
    expect(planLimit(null, 'WATCHLIST_MAX')).toBeUndefined();
  });
  it('keeps the plan independent of role access', () => {
    expect(canAccessRole(session(free), ['Trader'])).toBe(true);
  });
});
