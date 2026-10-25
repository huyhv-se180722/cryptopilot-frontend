import type { Tone } from '../../../components/ui/Badge';
import type { Copy } from '../../../i18n/locales/en';
import { formatCopy } from '../../../i18n/copy';
import type { CrawlStatus, NewsArticleStatus } from '../../../types/domain';

const MINUTE = 60_000;

/** "12 minutes ago": how long since a crawl, for the confirmation of a new one. */
export function crawlAge(copy: Copy, iso: string, now = Date.now()): string {
  const n = copy.newsAdmin;
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return n.ageNow;
  if (elapsed < 60 * MINUTE)
    return formatCopy(n.ageMinutes, { n: Math.floor(elapsed / MINUTE) });
  if (elapsed < 24 * 60 * MINUTE)
    return formatCopy(n.ageHours, { n: Math.floor(elapsed / (60 * MINUTE)) });
  return formatCopy(n.ageDays, { n: Math.floor(elapsed / (24 * 60 * MINUTE)) });
}

export const crawlTone: Record<CrawlStatus, Tone> = {
  SUCCESS: 'success',
  PARTIAL: 'warning',
  FAILED: 'danger',
};

export const articleTone: Record<NewsArticleStatus, Tone> = {
  PENDING: 'info',
  FAILED: 'danger',
  SUMMARIZED: 'success',
  HIDDEN: 'neutral',
};
