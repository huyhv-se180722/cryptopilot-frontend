import { describe, expect, it } from 'vitest';
import { describeChange } from './account-format';

const entry = (oldValue: string | null, newValue: string | null) => ({
  recordedAt: '2026-10-26T01:00:00Z',
  actorId: null,
  action: 'ROLE_CHANGED',
  oldValue,
  newValue,
  ipAddress: null,
});

describe('an audit entry’s change', () => {
  it('lists only the fields that changed and the reason apart', () => {
    expect(
      describeChange(
        entry(
          '{"email":"a@b.test","status":"ACTIVE","role":"TRADER"}',
          '{"email":"a@b.test","status":"ACTIVE","role":"ADMIN","reason":"Moderator"}',
        ),
      ),
    ).toEqual({
      fields: [{ name: 'role', from: 'TRADER', to: 'ADMIN' }],
      reason: 'Moderator',
    });
  });

  it('shows nothing changed for missing or unreadable values', () => {
    expect(describeChange(entry(null, 'not json'))).toEqual({
      fields: [],
      reason: null,
    });
    expect(describeChange(entry(null, '{"status":"LOCKED"}'))).toEqual({
      fields: [{ name: 'status', from: '—', to: 'LOCKED' }],
      reason: null,
    });
  });
});
