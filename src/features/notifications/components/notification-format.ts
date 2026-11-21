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
    case 'MEMBER':
      return '/community/members/' + id;
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

/**
 * The day a notification belongs to on SCR-15 (T-142): its local date
 * ("YYYY-MM-DD", never the browser's locale) as the key, worded Today or
 * Yesterday for the two latest days.
 */
export function notificationDay(
  copy: Copy,
  iso: string,
  now = Date.now(),
): { key: string; label: string } {
  const key = formatInstantLocal(iso).slice(0, 10);
  const today = formatInstantLocal(new Date(now).toISOString()).slice(0, 10);
  const yesterday = formatInstantLocal(
    new Date(now - 24 * 60 * MINUTE).toISOString(),
  ).slice(0, 10);
  const n = copy.notifications;
  return {
    key,
    label:
      key === today ? n.dayToday : key === yesterday ? n.dayYesterday : key,
  };
}

/** The bell's badge: the count, 99+ above that. */
export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}
