import type { Tone } from '../../../components/ui/Badge';
import type { Copy } from '../../../i18n/locales/en';
import { formatCopy } from '../../../i18n/copy';
import type { NewsSentiment } from '../../../types/domain';
import { formatInstantLocal } from '../../../utils/instant-format';

const MINUTE = 60_000;

/** "5m ago" up to a week, then the local date, as the community feed reads. */
export function newsAge(copy: Copy, iso: string, now = Date.now()): string {
  const n = copy.news;
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

/** The in-app page of an article (D-125). */
export function newsArticlePath(id: string): string {
  return '/news/' + encodeURIComponent(id);
}

/** The article written again, as its paragraphs: split on blank lines, empty ones dropped. */
export function newsParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');
}

/**
 * The page numbers a pager shows: the first and the last, the current one
 * with one on each side, and null where pages are skipped.
 */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out.at(-1) !== null) out.push(null);
  }
  return out;
}

/** The sentiments in the order the screen lists them. */
export const SENTIMENTS: readonly NewsSentiment[] = [
  'BULLISH',
  'NEUTRAL',
  'BEARISH',
];

/** Green, grey, red: the chip always carries its word too, never color alone. */
export const SENTIMENT_TONE = {
  BULLISH: 'success',
  NEUTRAL: 'neutral',
  BEARISH: 'danger',
} as const satisfies Record<NewsSentiment, Tone>;

export function sentimentLabel(copy: Copy, sentiment: NewsSentiment): string {
  return copy.news[`sentiment${sentiment}`];
}
