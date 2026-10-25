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

/** "@Minh_Tran": the name a mention starts with, as the card shows it. */
export function handleOf(name: string | null): string | null {
  const cleaned = (name ?? '').replace(/\(.*?\)/g, '').trim();
  return cleaned ? '@' + cleaned.replace(/\s+/g, '_') : null;
}

/** 5.3K, 12K, 1.2M: counts as the feed footer shows them. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  const [scaled, unit] = n < 1_000_000 ? [n / 1000, 'K'] : [n / 1e6, 'M'];
  return (
    (scaled < 10 ? scaled.toFixed(1).replace(/\.0$/, '') : Math.floor(scaled)) +
    unit
  );
}

/** A score with two decimals, as Influence Score reads (D-99). */
export function formatScore(score: number): string {
  return score.toFixed(2);
}

/** A cashtag: `$` and a coin symbol of 2 to 10 letters or digits. */
const CASHTAG = /\$([A-Za-z][A-Za-z0-9]{1,9})\b/g;

/** The text cut into plain runs and `$COIN` cashtags, in order. */
export function splitCashtags(
  text: string,
): readonly (
  { kind: 'text'; text: string } | { kind: 'coin'; coin: string }
)[] {
  const parts: (
    { kind: 'text'; text: string } | { kind: 'coin'; coin: string }
  )[] = [];
  let last = 0;
  for (const match of text.matchAll(CASHTAG)) {
    const start = match.index;
    if (start > last)
      parts.push({ kind: 'text', text: text.slice(last, start) });
    parts.push({ kind: 'coin', coin: (match[1] ?? '').toUpperCase() });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** The distinct coins a text tags with `$`, in the order they appear. */
export function cashtagsOf(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(CASHTAG)].map((m) => (m[1] ?? '').toUpperCase()),
    ),
  ];
}
