import type { Copy } from '../../../i18n/locales/en';
import { formatCopy } from '../../../i18n/copy';
import { formatInstantLocal } from '../../../utils/instant-format';

const MINUTE = 60_000;

/**
 * "5m ago" up to a week, then the local date: the feed reads like a
 * community, never through the browser's locale formatting.
 */
export function postAge(copy: Copy, iso: string, now = Date.now()): string {
  const c = copy.community;
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return c.ageNow;
  if (elapsed < 60 * MINUTE)
    return formatCopy(c.ageMinutes, { n: Math.floor(elapsed / MINUTE) });
  if (elapsed < 24 * 60 * MINUTE)
    return formatCopy(c.ageHours, { n: Math.floor(elapsed / (60 * MINUTE)) });
  if (elapsed < 7 * 24 * 60 * MINUTE)
    return formatCopy(c.ageDays, {
      n: Math.floor(elapsed / (24 * 60 * MINUTE)),
    });
  return formatInstantLocal(iso).slice(0, 10);
}

/** Two letters for an avatar without a picture. */
export function initials(name: string | null): string {
  const words = (name ?? '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/);
  const letters = words
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

/** A post was edited when its last change is a minute past its creation. */
export function wasEdited(createdAt: string, updatedAt: string): boolean {
  return Date.parse(updatedAt) - Date.parse(createdAt) > MINUTE;
}

export const memberPath = (userId: string) =>
  '/community/members/' + encodeURIComponent(userId);
export const postPath = (id: string) => '/community/' + encodeURIComponent(id);
