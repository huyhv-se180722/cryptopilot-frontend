import { describe, expect, it } from 'vitest';
import type { Session } from '../../types/domain';
import { canAccessRole, hasEntitlement } from './access';

/** Test-only principal, never imported by application modules. */
const session: Session = {
  user: {
    id: 'test-user',
    email: 'trader@example.test',
    fullName: 'Test trader',
    role: 'Trader',
    status: 'active',
  },
  entitlements: { aiAccess: true, videoPosting: false },
};
describe('access control', () => {
  it('blocks guests and unauthorized roles', () => {
    expect(canAccessRole(null, ['Trader'])).toBe(false);
    expect(canAccessRole(session, ['Admin'])).toBe(false);
    expect(canAccessRole(session, ['Trader'])).toBe(true);
  });
  it('blocks suspended and banned accounts regardless of role or entitlement', () => {
    for (const status of ['suspended', 'banned'] as const) {
      const blocked = { ...session, user: { ...session.user, status } };
      expect(canAccessRole(blocked, ['Trader'])).toBe(false);
      expect(hasEntitlement(blocked, 'aiAccess')).toBe(false);
    }
  });
  it('keeps entitlements independent from role and from each other', () => {
    expect(hasEntitlement(session, 'aiAccess')).toBe(true);
    expect(hasEntitlement(session, 'videoPosting')).toBe(false);
    const expired = {
      ...session,
      entitlements: { aiAccess: false, videoPosting: false },
    };
    expect(canAccessRole(expired, ['Trader'])).toBe(true);
    expect(hasEntitlement(expired, 'aiAccess')).toBe(false);
  });
});
