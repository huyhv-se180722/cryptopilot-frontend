import { describe, expect, it } from 'vitest';
import { notificationPath } from './notification-format';

describe('where a notification opens', () => {
  it('follows each reference to its screen', () => {
    expect(notificationPath({ type: 'ALERT', id: 'a1' })).toBe('/alerts');
    expect(notificationPath({ type: 'PLAN', id: 'p 1' })).toBe('/plans/p%201');
    expect(notificationPath({ type: 'POST', id: 'x' })).toBe('/community/x');
    expect(notificationPath({ type: 'SUBSCRIPTION', id: 's' })).toBe(
      '/subscription',
    );
    expect(notificationPath({ type: 'NEWS_SOURCE', id: 'n' })).toBe(
      '/admin/news-sources',
    );
    expect(notificationPath(null)).toBeNull();
  });
});
