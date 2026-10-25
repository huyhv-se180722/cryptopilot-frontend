import type { Copy } from '../../../i18n/locales/en';
import { formatCopy } from '../../../i18n/copy';
import type { AppNotification } from '../../../types/domain';
import { formatInstantLocal } from '../../../utils/instant-format';

const MINUTE = 60_000;

/**
 * Where opening a notification goes (SRS 3.4.5: the referenced alert,
 * plan, post or subscription; a news source, SCR-41). Alerts have no
 * page of their own, so the alert list opens; null when the notification
 * references nothing.
 */
export function notificationPath(
  reference: AppNotification['reference'],
): string | null {
  if (!reference) return null;
  const id = encodeURIComponent(reference.id);
  switch (reference.type) {
    case 'ALERT':
      return '/alerts';
    case 'PLAN':
      return '/plans/' + id;
    case 'POST':
      return '/community/' + id;
    case 'SUBSCRIPTION':
      return '/subscription';
    case 'NEWS_SOURCE':
      return '/admin/news-sources';
  }
}

/** "5m ago" up to a week, then the local date (never the browser locale). */
export function notificationAge(
  copy: Copy,
  iso: string,
  now = Date.now(),
): string {
  const n = copy.notifications;
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return n.ageNow;
  if (elapsed < 60 * MINUTE)
    return formatCopy(n.ageMinutes, { n: Math.floor(elapsed / MINUTE) });
  if (elapsed < 24 * 60 * MINUTE)
    return formatCopy(n.ageHours, { n: Math.floor(elapsed / (60 * MINUTE)) });
  if (elapsed < 7 * 24 * 60 * MINUTE)
    return formatCopy(n.ageDays, {
      n: Math.floor(elapsed / (24 * 60 * MINUTE)),
    });
  return formatInstantLocal(iso).slice(0, 10);
}

/** The bell's badge: the count, 99+ above that. */
export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
