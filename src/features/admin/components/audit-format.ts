import type { Tone } from '../../../components/ui/Badge';
import type {
  AuditLogEntry,
  AuditValue,
  ServiceStatus,
  SystemEventSource,
} from '../../../types/domain';

/**
 * The audit actions of the backend (`AuditAction`), grouped as the filter
 * of SCR-44 offers them. An action the backend adds later still shows, by
 * its code.
 */
export const AUDIT_ACTION_GROUPS = {
  accounts: [
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'ACCOUNT_BANNED',
    'ROLE_CHANGED',
  ],
  moderation: [
    'POST_HIDDEN',
    'POST_RESTORED',
    'POST_REMOVED',
    'REPORTS_DISMISSED',
    'USER_WARNED',
    'COMMENT_HIDDEN',
    'COMMENT_REMOVED',
    'COMMENT_RESTORED',
  ],
  news: ['NEWS_ARTICLE_HIDDEN', 'NEWS_ARTICLE_RESTORED'],
  configuration: [
    'CONFIGURATION_CREATED',
    'CONFIGURATION_CHANGED',
    'CONFIGURATION_DELETED',
  ],
} as const;

export type AuditActionGroup = keyof typeof AUDIT_ACTION_GROUPS;
export type KnownAuditAction =
  (typeof AUDIT_ACTION_GROUPS)[AuditActionGroup][number];

const KNOWN_ACTIONS: ReadonlySet<string> = new Set(
  Object.values(AUDIT_ACTION_GROUPS).flat(),
);

export const isKnownAction = (action: string): action is KnownAuditAction =>
  KNOWN_ACTIONS.has(action);

/** The kinds of row an entry is about (`AuditedEntity`). */
export const AUDITED_ENTITIES = [
  'USER_ACCOUNT',
  'FORUM_POST',
  'FORUM_COMMENT',
  'CRYPTO_PAIR',
  'LEVERAGE_BRACKET',
  'SUBSCRIPTION_PACKAGE',
  'SUBSCRIPTION_ORDER',
  'NEWS_SOURCE',
  'NEWS_ARTICLE',
  'AI_CONFIGURATION',
  'SYSTEM_SETTING',
  'ACADEMY_ARTICLE',
  'ACADEMY_TERM',
  'ACADEMY_TOPIC',
] as const;

export type AuditedEntity = (typeof AUDITED_ENTITIES)[number];

export const isKnownEntity = (type: string): type is AuditedEntity =>
  (AUDITED_ENTITIES as readonly string[]).includes(type);

const DANGER = new Set([
  'ACCOUNT_BANNED',
  'ACCOUNT_LOCKED',
  'POST_REMOVED',
  'COMMENT_REMOVED',
  'CONFIGURATION_DELETED',
]);
const WARNING = new Set([
  'ROLE_CHANGED',
  'POST_HIDDEN',
  'COMMENT_HIDDEN',
  'USER_WARNED',
  'NEWS_ARTICLE_HIDDEN',
]);
const SUCCESS = new Set([
  'ACCOUNT_UNLOCKED',
  'POST_RESTORED',
  'COMMENT_RESTORED',
  'NEWS_ARTICLE_RESTORED',
  'CONFIGURATION_CREATED',
]);

/** Red for what takes away, amber for what restricts, green for what gives back. */
export function actionTone(action: string): Tone {
  if (DANGER.has(action)) return 'danger';
  if (WARNING.has(action)) return 'warning';
  if (SUCCESS.has(action)) return 'success';
  if (KNOWN_ACTIONS.has(action)) return 'info';
  return 'neutral';
}

export const serviceTone: Record<ServiceStatus, Tone> = {
  UP: 'success',
  DEGRADED: 'warning',
  DOWN: 'danger',
  UNKNOWN: 'neutral',
};

/** The external services, in the order the health panel shows them. */
export const EXTERNAL_SOURCES: readonly SystemEventSource[] = [
  'BINANCE_REST',
  'AI_SERVICE',
  'NEWS_SOURCE',
  'MEDIA_STORAGE',
  'MAIL',
];

/** Every source of the system log, as its filter offers them. */
export const SYSTEM_EVENT_SOURCES: readonly SystemEventSource[] = [
  'APPLICATION',
  'SCHEDULED_JOB',
  ...EXTERNAL_SOURCES,
];

/** One field of a change: its value before and after. */
export interface ChangedField {
  field: string;
  before: AuditValue | null;
  after: AuditValue | null;
  /** Whether the value is different (a field may be repeated for context). */
  changed: boolean;
  /** Present before only (removed) or after only (added). */
  side: 'both' | 'before' | 'after';
}

const isObject = (
  value: AuditValue | null,
): value is { readonly [key: string]: AuditValue } =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The fields of an entry, before against after, in the order they first
 * appear: a value that is not an object reads as one field, `value`.
 */
export function changedFields(
  entry: Pick<AuditLogEntry, 'oldValue' | 'newValue'>,
): ChangedField[] {
  const before = isObject(entry.oldValue)
    ? entry.oldValue
    : entry.oldValue === null
      ? {}
      : { value: entry.oldValue };
  const after = isObject(entry.newValue)
    ? entry.newValue
    : entry.newValue === null
      ? {}
      : { value: entry.newValue };
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return names.map((field) => {
    const inBefore = Object.hasOwn(before, field);
    const inAfter = Object.hasOwn(after, field);
    const b = inBefore ? (before[field] ?? null) : null;
    const a = inAfter ? (after[field] ?? null) : null;
    return {
      field,
      before: b,
      after: a,
      changed: !inBefore || !inAfter || formatValue(b) !== formatValue(a),
      side: inBefore && inAfter ? 'both' : inBefore ? 'before' : 'after',
    };
  });
}

/** A stored value as one line: text as it is, anything else as JSON. */
export function formatValue(value: AuditValue | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** The reason an administrator gave, kept in the values by every command. */
export function reasonOf(
  entry: Pick<AuditLogEntry, 'oldValue' | 'newValue'>,
): string | null {
  for (const value of [entry.newValue, entry.oldValue]) {
    if (isObject(value) && typeof value.reason === 'string' && value.reason)
      return value.reason;
  }
  return null;
}

/** The changed fields worth a line in the table, the reason left out. */
export function summaryFields(
  entry: Pick<AuditLogEntry, 'oldValue' | 'newValue'>,
): ChangedField[] {
  return changedFields(entry).filter(
    (field) => field.changed && field.field !== 'reason',
  );
}

/** Where the object of an entry opens in the console, when it has a page. */
export function entityPath(
  entityType: string | null,
  entityId: string | null,
): string | null {
  if (!entityId) return null;
  if (entityType === 'USER_ACCOUNT')
    return '/admin/users/' + encodeURIComponent(entityId);
  if (entityType === 'FORUM_POST')
    return '/community/' + encodeURIComponent(entityId);
  return null;
}

/** The first block of a uuid, enough to tell rows apart at a glance. */
export const shortId = (id: string) => id.split('-')[0] ?? id;

/** "2 min ago" in the interface's language; "just now" under a minute. */
export function relativeTime(
  iso: string,
  now: number,
  locale: string,
  justNow: string,
): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  if (Math.abs(seconds) < 45) return justNow;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}

/** A lag in seconds as "45 s", "3 min", "2 h 5 min". */
export function formatLag(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Initials for an actor's avatar: of the display name, else the email. */
export function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? '?').trim();
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')
      : source.slice(0, 2);
  return letters.toUpperCase() || '?';
}
