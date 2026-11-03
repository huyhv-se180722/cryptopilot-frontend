import { describe, expect, it } from 'vitest';
import {
  actionTone,
  changedFields,
  entityPath,
  formatLag,
  initials,
  reasonOf,
  relativeTime,
  summaryFields,
} from './audit-format';

describe('audit entry changes', () => {
  it('pairs every field before and after, marking added, removed and unchanged', () => {
    const fields = changedFields({
      oldValue: { status: 'ACTIVE', role: 'TRADER', note: 'x' },
      newValue: { status: 'LOCKED', role: 'TRADER', reason: 'spam' },
    });
    expect(fields.map((f) => [f.field, f.side, f.changed])).toEqual([
      ['status', 'both', true],
      ['role', 'both', false],
      ['note', 'before', true],
      ['reason', 'after', true],
    ]);
  });

  it('reads a creation, a value that is not an object, and nothing at all', () => {
    expect(
      changedFields({ oldValue: null, newValue: { symbol: 'BTCUSDT' } }),
    ).toEqual([
      {
        field: 'symbol',
        before: null,
        after: 'BTCUSDT',
        changed: true,
        side: 'after',
      },
    ]);
    expect(changedFields({ oldValue: 1, newValue: 2 })[0]?.field).toBe('value');
    expect(changedFields({ oldValue: null, newValue: null })).toEqual([]);
  });

  it('keeps the reason out of the summary and finds it on either side', () => {
    const entry = {
      oldValue: { status: 'ACTIVE' },
      newValue: { status: 'BANNED', reason: 'fraud' },
    };
    expect(summaryFields(entry).map((f) => f.field)).toEqual(['status']);
    expect(reasonOf(entry)).toBe('fraud');
    expect(reasonOf({ oldValue: { reason: 'old' }, newValue: null })).toBe(
      'old',
    );
    expect(reasonOf({ oldValue: null, newValue: { reason: '' } })).toBe(null);
  });
});

describe('audit formatting', () => {
  it('colours what takes away red and what gives back green', () => {
    expect(actionTone('ACCOUNT_BANNED')).toBe('danger');
    expect(actionTone('POST_HIDDEN')).toBe('warning');
    expect(actionTone('ACCOUNT_UNLOCKED')).toBe('success');
    expect(actionTone('CONFIGURATION_CHANGED')).toBe('info');
    expect(actionTone('SOMETHING_NEW')).toBe('neutral');
  });

  it('links an account and a post, nothing else', () => {
    expect(entityPath('USER_ACCOUNT', 'a b')).toBe('/admin/users/a%20b');
    expect(entityPath('FORUM_POST', 'p1')).toBe('/community/p1');
    expect(entityPath('SYSTEM_SETTING', 'k')).toBe(null);
    expect(entityPath('USER_ACCOUNT', null)).toBe(null);
  });

  it('says how long ago, and how far behind a feed is', () => {
    const now = Date.parse('2026-11-03T06:00:00Z');
    expect(relativeTime('2026-11-03T05:59:40Z', now, 'en', 'just now')).toBe(
      'just now',
    );
    expect(relativeTime('2026-11-03T05:55:00Z', now, 'en', 'x')).toBe(
      '5 minutes ago',
    );
    expect(relativeTime('2026-11-03T03:00:00Z', now, 'en', 'x')).toBe(
      '3 hours ago',
    );
    expect(relativeTime('2026-11-01T06:00:00Z', now, 'en', 'x')).toBe(
      '2 days ago',
    );
    expect(formatLag(45)).toBe('45 s');
    expect(formatLag(180)).toBe('3 min');
    expect(formatLag(7500)).toBe('2 h 5 min');
    expect(formatLag(7200)).toBe('2 h');
  });

  it('draws initials from the name, else the email', () => {
    expect(initials('Trần Minh Khoa', null)).toBe('TM');
    expect(initials(null, 'admin@dev.local')).toBe('AD');
    expect(initials(null, null)).toBe('?');
  });
});
