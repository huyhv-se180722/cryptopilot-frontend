import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Triangle } from 'lucide-react';
import { CoinLogo } from '../../../components/ui/CoinLogo';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy, useLocale } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { CoinMarket, PostSummary } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { toFixedDecimal } from '../../../utils/decimal-format';
import { compare } from '../../../utils/decimal-math';
import { relativeTime } from '../../admin/components/audit-format';
import { useFeedPage } from '../../community/hooks/use-community';
import {
  compactUsd,
  formatUsd,
  sortCoins,
  type CoinView,
} from '../coin-market';
import { ChangeBars, FearGreedGauge } from './CoinCharts';

/** "▲0.26%" / "▼1.20%": a change with its direction, never colour alone. */
export function Change({
  value,
  className,
}: {
  value: string | null;
  className?: string;
}) {
  if (value === null) return <span className="text-muted-x">—</span>;
  const rounded = toFixedDecimal(value, 2);
  const down = rounded.startsWith('-');
  const flat = compare(rounded, '0') === 0;
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-0.5 font-mono tabular-nums',
        flat ? 'text-muted' : down ? 'text-negative' : 'text-positive',
        className,
      )}
    >
      {!flat && (
        <Triangle
          aria-hidden="true"
          size={8}
          strokeWidth={0}
          fill="currentColor"
          className={down ? 'rotate-180' : undefined}
        />
      )}
      {(down ? rounded.slice(1) : rounded) + '%'}
    </span>
  );
}

function CardShell({
  title,
  to,
  children,
  extra,
}: {
  title: string;
  to?: string | undefined;
  children: ReactNode;
  extra?: ReactNode;
}) {
  const heading = (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-fg">
      {title}
      {to && (
        <ChevronRight size={14} aria-hidden="true" className="text-muted" />
      )}
    </span>
  );
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        {to ? (
          <Link to={to} className="no-underline hover:opacity-80">
            {heading}
          </Link>
        ) : (
          heading
        )}
        {extra}
      </div>
      {children}
    </section>
  );
}

function Tile({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        'flex min-w-0 flex-col justify-between rounded-xl border border-line bg-page-alt p-3',
        className,
      )}
    >
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

const fearLabel = (
  value: number,
  c: ReturnType<typeof useCopy>['coinMarket'],
) =>
  value < 25
    ? c.fgExtremeFear
    : value < 45
      ? c.fgFear
      : value <= 55
        ? c.fgNeutral
        : value < 75
          ? c.fgGreed
          : c.fgExtremeGreed;

export function MarketStatusCard({ data }: { data: CoinMarket | undefined }) {
  const c = useCopy().coinMarket;
  const fear = data?.fearGreed;
  const season = data?.altcoinSeason;
  return (
    <CardShell title={c.marketStatus}>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <Tile label={c.fearGreed} className="row-span-2 items-center">
          {fear ? (
            <FearGreedGauge
              value={fear.value}
              label={fearLabel(fear.value, c)}
              ariaLabel={formatCopy(c.fearGreedAria, {
                value: String(fear.value),
                label: fearLabel(fear.value, c),
              })}
            />
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </Tile>
        <Tile label={c.marketCap}>
          {data?.global ? (
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-base font-bold text-fg">
                {compactUsd(data.global.marketCapUsd)}
              </span>
              <Change
                value={data.global.marketCapChange24hPercent}
                className="text-xs"
              />
            </span>
          ) : (
            <span className="text-muted-x">—</span>
          )}
        </Tile>
        <Tile label={c.btcDominance}>
          {data?.global?.bitcoinDominancePercent ? (
            <span className="text-base font-bold text-fg">
              {toFixedDecimal(data.global.bitcoinDominancePercent, 2)}%
            </span>
          ) : (
            <span className="text-muted-x">—</span>
          )}
        </Tile>
        <Tile label={c.altcoinSeason} className="col-span-2">
          {season ? (
            <div
              className="flex items-center gap-3"
              title={formatCopy(c.altcoinSeasonHint, {
                count: String(season.altcoins),
                days: String(season.days),
              })}
            >
              <span className="text-base font-bold text-fg">
                {season.index}
                <span className="text-xs font-normal text-muted">/100</span>
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="relative h-1.5 rounded-full bg-linear-to-r from-warning via-raised to-primary">
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-page bg-fg"
                    style={{ left: `${season.index}%` }}
                  />
                </span>
                <span className="flex justify-between text-xs text-muted">
                  <span>{c.seasonBitcoin}</span>
                  <span>{c.seasonAltcoin}</span>
                </span>
              </span>
            </div>
          ) : (
            <span className="text-muted-x">—</span>
          )}
        </Tile>
      </div>
    </CardShell>
  );
}

export function TrendingCard({
  rows,
  loading,
}: {
  rows: readonly CoinView[];
  loading: boolean;
}) {
  const c = useCopy().coinMarket;
  const top = sortCoins(
    rows.filter((row) => row.change24h !== null),
    { key: 'change24h', descending: true },
  ).slice(0, 5);
  return (
    <CardShell
      title={c.trending}
      extra={<span className="text-xs text-muted">{c.trendingHint}</span>}
    >
      {top.length === 0 && !loading ? (
        <p className="text-xs text-muted">{c.empty}</p>
      ) : top.length === 0 ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <ol className="flex flex-col gap-1">
          {top.map((row, index) => (
            <li key={row.coin.symbol}>
              <Link
                to={row.href ?? '/markets'}
                className="grid grid-cols-[1rem_minmax(0,1fr)_auto_4.5rem] items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-fg no-underline hover:bg-raised"
              >
                <span className="text-xs text-muted">{index + 1}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <CoinLogo
                    src={row.coin.logoUrl}
                    symbol={row.coin.symbol}
                    size="sm"
                  />
                  <span className="truncate font-semibold">
                    {row.coin.symbol}
                  </span>
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {row.price ? formatUsd(row.price) : '—'}
                </span>
                <Change value={row.change24h} className="justify-end text-xs" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </CardShell>
  );
}

export function DerivativesCard({
  data,
  futuresVolume,
  futuresSymbol,
}: {
  data: CoinMarket | undefined;
  futuresVolume: string | null;
  /** The Futures pair the card opens, or none when no coin is on Futures. */
  futuresSymbol: string | null;
}) {
  const c = useCopy().coinMarket;
  const interest = data?.openInterest;
  return (
    <CardShell
      title={c.derivatives}
      to={futuresSymbol ? `/markets/futures/${futuresSymbol}` : undefined}
      extra={<span className="text-xs text-muted">{c.futuresNote}</span>}
    >
      <div className="mb-2 rounded-xl border border-line bg-page-alt p-3">
        <span className="text-xs text-muted">{c.openInterestChart}</span>
        {interest ? (
          <ChangeBars
            values={interest.lastDay.map((point) => Number(point.valueUsd))}
            label={c.openInterestChart}
          />
        ) : (
          <Skeleton className="mt-2 h-14 w-full" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Tile label={c.openInterest}>
          {interest ? (
            <span className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-base font-bold text-fg">
                {compactUsd(interest.valueUsd)}
              </span>
              <Change value={interest.change24hPercent} className="text-xs" />
            </span>
          ) : (
            <span className="text-muted-x">—</span>
          )}
        </Tile>
        <Tile label={c.futuresVolume}>
          <span className="text-base font-bold text-fg">
            {futuresVolume ? compactUsd(futuresVolume) : '—'}
          </span>
        </Tile>
      </div>
    </CardShell>
  );
}

function CommunityPost({ post, now }: { post: PostSummary; now: number }) {
  const c = useCopy().coinMarket;
  const locale = useLocale();
  const name = post.author.displayName ?? c.unknownAuthor;
  return (
    <Link
      to={`/community/${post.id}`}
      className="block rounded-xl border border-line bg-page-alt p-3 text-fg no-underline hover:border-line-strong"
    >
      <span className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised text-xs font-bold text-fg-2">
          {post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            name.slice(0, 2).toUpperCase()
          )}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs">
            <span className="truncate font-semibold">{name}</span>
            <span className="text-muted">
              · {relativeTime(post.createdAt, now, locale, c.justNow)}
            </span>
            {post.sentiment && (
              <span
                className={classNames(
                  'font-semibold',
                  post.sentiment === 'BULLISH'
                    ? 'text-positive'
                    : 'text-negative',
                )}
              >
                {post.sentiment === 'BULLISH'
                  ? '↗ ' + c.bullish
                  : '↘ ' + c.bearish}
              </span>
            )}
          </span>
          <span className="block text-xs text-muted">
            {formatCopy(c.influence, {
              score: post.authorStanding.influenceScore.toFixed(2),
            })}
          </span>
        </span>
      </span>
      <span className="mt-2 line-clamp-2 text-xs font-semibold">
        {post.title || post.excerpt}
      </span>
    </Link>
  );
}

export function CommunityCard({ now }: { now: number }) {
  const c = useCopy().coinMarket;
  const feed = useFeedPage({ tab: 'TRENDING' }, 1);
  const posts = (feed.data?.items ?? []).slice(0, 2);
  return (
    <CardShell title={c.community} to="/community">
      {feed.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <p className="text-xs text-muted">{c.communityEmpty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.map((post) => (
            <CommunityPost key={post.id} post={post} now={now} />
          ))}
        </div>
      )}
    </CardShell>
  );
}
