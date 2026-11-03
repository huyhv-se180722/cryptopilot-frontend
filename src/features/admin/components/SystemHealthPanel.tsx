import type { ReactNode } from 'react';
import {
  Activity,
  Bot,
  CandlestickChart,
  ImageIcon,
  Mail,
  Rss,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { useCopy, useLocale } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  FeedHealth,
  ServiceHealth,
  SystemEventSource,
  SystemHealth,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import {
  formatInstantLocal,
  formatInstantUtc,
} from '../../../utils/instant-format';
import {
  EXTERNAL_SOURCES,
  formatLag,
  relativeTime,
  serviceTone,
} from './audit-format';

const icons: Partial<Record<SystemEventSource, LucideIcon>> = {
  BINANCE_REST: Activity,
  AI_SERVICE: Bot,
  NEWS_SOURCE: Rss,
  MEDIA_STORAGE: ImageIcon,
  MAIL: Mail,
};

const edge = {
  success: 'before:bg-positive',
  warning: 'before:bg-warning',
  danger: 'before:bg-negative',
  neutral: 'before:bg-line-strong',
  info: 'before:bg-primary',
} as const;

const iconBox = {
  success: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-negative-soft text-negative',
  neutral: 'bg-raised text-muted-dim',
  info: 'bg-primary-soft text-primary',
} as const;

/**
 * SCR-44 health panel (UC-46: "the status of the external APIs and of data
 * ingestion"): one card per external service, coloured by its status and
 * never by colour alone, and one per market data feed. Times read relative
 * to the server's check, so a wrong clock on this device does not age them.
 */
export function SystemHealthPanel({ health }: { health: SystemHealth }) {
  const copy = useCopy();
  const t = copy.adminAuditLog;
  const bySource = new Map(health.services.map((s) => [s.source, s]));
  const services = EXTERNAL_SOURCES.map((source) => bySource.get(source))
    .filter((s): s is ServiceHealth => s !== undefined)
    .concat(
      health.services.filter((s) => !EXTERNAL_SOURCES.includes(s.source)),
    );
  const up = services.filter((s) => s.status === 'UP').length;
  return (
    <div className="grid gap-4">
      <section aria-labelledby="health-services">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="health-services"
            className="text-[10px] font-semibold tracking-widest text-muted-x uppercase"
          >
            {t.healthTitle}
            <span className="ml-2 font-mono tracking-normal text-muted-dim normal-case">
              {up}/{services.length}
            </span>
          </h2>
          <p className="text-[11px] text-muted-dim">
            {formatCopy(t.healthHint, { minutes: health.recentWindowMinutes })}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {services.map((service) => (
            <ServiceCard
              key={service.source}
              service={service}
              checkedAt={health.checkedAt}
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby="health-feeds">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="health-feeds"
            className="text-[10px] font-semibold tracking-widest text-muted-x uppercase"
          >
            {t.feedsTitle}
          </h2>
          <p className="text-[11px] text-muted-dim">
            {formatCopy(t.feedsHint, { minutes: health.staleAfterMinutes })}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {health.feeds.map((feed) => (
            <FeedCard key={feed.market} feed={feed} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Shell({
  tone,
  children,
  label,
}: {
  tone: keyof typeof edge;
  label: string;
  children: ReactNode;
}) {
  return (
    <li
      aria-label={label}
      className={classNames(
        'relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-panel',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
        edge[tone],
      )}
    >
      {children}
    </li>
  );
}

function ServiceCard({
  service,
  checkedAt,
}: {
  service: ServiceHealth;
  checkedAt: string;
}) {
  const copy = useCopy();
  const locale = useLocale();
  const t = copy.adminAuditLog;
  const tone = serviceTone[service.status];
  const Icon = icons[service.source] ?? Activity;
  const name = t[`source${service.source}`];
  const now = Date.parse(checkedAt);
  const ago = (iso: string | null, none: string) =>
    iso ? (
      <time dateTime={iso} title={formatInstantUtc(iso)}>
        {relativeTime(iso, now, locale, t.justNow)}
      </time>
    ) : (
      <span className="text-muted-x">{none}</span>
    );
  return (
    <Shell tone={tone} label={name + ': ' + t[`status${service.status}`]}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={classNames(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
              iconBox[tone],
            )}
          >
            <Icon size={15} />
          </span>
          <span className="truncate text-xs font-semibold text-fg">{name}</span>
        </span>
        <Badge tone={tone} withDot>
          {t[`status${service.status}`]}
        </Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-muted-dim">{t.lastAnswer}</dt>
        <dd className="m-0 text-right text-fg-2">
          {ago(service.lastSuccessAt, t.notSinceStart)}
        </dd>
        <dt className="text-muted-dim">{t.lastFailure}</dt>
        <dd className="m-0 text-right text-fg-2">
          {ago(service.lastFailureAt, t.none)}
        </dd>
        <dt className="text-muted-dim">{t.failures24h}</dt>
        <dd
          className={classNames(
            'm-0 text-right font-mono',
            service.failures24h > 0 ? 'text-negative' : 'text-fg-2',
          )}
        >
          {service.failures24h}
        </dd>
      </dl>
      {service.bannedUntil && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-negative-line bg-negative-soft px-2.5 py-2 text-[11px] text-negative">
          <ShieldAlert
            size={13}
            aria-hidden="true"
            className="mt-px shrink-0"
          />
          {formatCopy(t.bannedUntil, {
            time: formatInstantLocal(service.bannedUntil),
          })}
        </p>
      )}
      {service.lastError && service.status !== 'UP' && (
        <p
          className="mt-3 line-clamp-2 rounded-lg bg-page-alt px-2.5 py-2 font-mono text-[10.5px] leading-snug break-words text-muted"
          title={service.lastError}
        >
          {service.lastError}
        </p>
      )}
    </Shell>
  );
}

function FeedCard({ feed }: { feed: FeedHealth }) {
  const copy = useCopy();
  const t = copy.adminAuditLog;
  const tone =
    feed.latestCandleAt === null
      ? 'neutral'
      : feed.stale
        ? 'warning'
        : 'success';
  const name = t[`feed${feed.market}`];
  return (
    <Shell tone={tone} label={name}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className={classNames(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
              iconBox[tone],
            )}
          >
            <CandlestickChart size={15} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-semibold text-fg">{name}</span>
            <span className="text-[11px] text-muted-dim">
              {feed.latestCandleAt ? (
                <>
                  {t.latestCandle}{' '}
                  <time
                    dateTime={feed.latestCandleAt}
                    title={formatInstantUtc(feed.latestCandleAt)}
                    className="font-mono text-fg-2"
                  >
                    {formatInstantLocal(feed.latestCandleAt)}
                  </time>
                  {feed.lagSeconds !== null && (
                    <>
                      {' · '}
                      {formatCopy(t.behind, {
                        lag: formatLag(feed.lagSeconds),
                      })}
                    </>
                  )}
                </>
              ) : (
                t.feedNone
              )}
            </span>
          </span>
        </span>
        {feed.latestCandleAt && (
          <Badge tone={feed.stale ? 'warning' : 'success'} withDot>
            {feed.stale ? t.feedStale : t.feedLive}
          </Badge>
        )}
      </div>
    </Shell>
  );
}
