import { z } from 'zod';
import type { Copy } from '../../i18n/locales/en';
import { formatCopy } from '../../i18n/copy';
import { fieldErrorText } from '../../i18n/messages';
import type { NewsSource, NewsSourceDraft } from '../../types/domain';

/**
 * Client mirror of `NewsSourceRequest` (UC-49, BR-49); issues are SRS
 * message ids and the server stays authoritative: it also reads the feed
 * once before saving (NEWS_FEED_UNREADABLE) and checks the selectors.
 */
export const MIN_INTERVAL_MINUTES = 15;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

const optional = (max: number) => z.string().trim().max(max, 'MSG15');

export const sourceSchema = z.object({
  sourceName: z.string().trim().min(1, 'MSG01').max(100, 'MSG15'),
  feedUrl: z
    .string()
    .trim()
    .min(1, 'MSG01')
    .max(1000, 'MSG15')
    .refine((value) => /^https?:\/\/\S+$/i.test(value), { message: 'MSG15' }),
  crawlIntervalMinutes: z
    .string()
    .trim()
    .min(1, 'MSG01')
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) >= MIN_INTERVAL_MINUTES,
      { message: 'MSG15' },
    ),
  active: z.boolean(),
  categoryFilter: optional(256),
  bodySelector: optional(512),
  excludedSelectors: optional(1024),
  userAgent: optional(256).refine((value) => PRINTABLE_ASCII.test(value), {
    message: 'MSG15',
  }),
});
export type SourceFormValues = z.infer<typeof sourceSchema>;
export const SOURCE_FIELDS = [
  'sourceName',
  'feedUrl',
  'crawlIntervalMinutes',
  'active',
  'categoryFilter',
  'bodySelector',
  'excludedSelectors',
  'userAgent',
] as const;

export function toSourceValues(source: NewsSource | null): SourceFormValues {
  return {
    sourceName: source?.sourceName ?? '',
    feedUrl: source?.feedUrl ?? '',
    crawlIntervalMinutes: String(source?.crawlIntervalMinutes ?? 60),
    active: source?.active ?? true,
    categoryFilter: source?.categoryFilter ?? '',
    bodySelector: source?.bodySelector ?? '',
    excludedSelectors: source?.excludedSelectors ?? '',
    userAgent: source?.userAgent ?? '',
  };
}

/** Full replacement: a blank optional field is sent as none. */
export function toSourceDraft(values: SourceFormValues): NewsSourceDraft {
  const blankToNull = (value: string) => value.trim() || null;
  return {
    sourceName: values.sourceName.trim(),
    feedUrl: values.feedUrl.trim(),
    crawlIntervalMinutes: Number(values.crawlIntervalMinutes),
    active: values.active,
    categoryFilter: blankToNull(values.categoryFilter),
    bodySelector: blankToNull(values.bodySelector),
    excludedSelectors: blankToNull(values.excludedSelectors),
    userAgent: blankToNull(values.userAgent),
  };
}

/** Field error text: MSG01 names the field; MSG15 says what is wrong with it. */
export function sourceFieldError(
  copy: Copy,
  id: string | undefined,
  field: (typeof SOURCE_FIELDS)[number],
  label: string,
): string | undefined {
  if (!id) return undefined;
  if (id !== 'MSG15') return fieldErrorText(copy, id, label);
  const n = copy.newsAdmin;
  if (field === 'crawlIntervalMinutes') return n.intervalTooShort;
  if (field === 'feedUrl') return n.feedUrlInvalid;
  return formatCopy(n.fieldInvalid, { field: label });
}
