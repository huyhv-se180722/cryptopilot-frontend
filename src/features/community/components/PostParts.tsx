import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Check,
  EyeOff,
  Pin,
  Plus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type {
  PostAuthor,
  PostSentiment,
  PostSummary,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { toFixedDecimal } from '../../../utils/decimal-format';
import { formatInstantUtc } from '../../../utils/instant-format';
import { useCoinPrices } from './coin-prices';
import {
  formatScore,
  handleOf,
  initials,
  memberPath,
  postAge,
  splitCashtags,
  wasEdited,
} from './post-format';

/** Author avatar: a circle, initials when there is no picture. */
export function AuthorAvatar({
  author,
  size = 30,
}: {
  author: Pick<PostAuthor, 'displayName' | 'avatarUrl'>;
  size?: 24 | 30 | 40 | 56;
}) {
  const box = {
    24: 'size-6 text-[9px]',
    30: 'size-[30px] text-[10px]',
    40: 'size-10 text-xs',
    56: 'size-14 text-base',
  }[size];
  return author.avatarUrl ? (
    <img
      src={author.avatarUrl}
      alt=""
      className={classNames(
        box,
        'shrink-0 rounded-full border border-line-strong object-cover',
      )}
    />
  ) : (
    <span
      aria-hidden="true"
      className={classNames(
        box,
        'flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-linear-135 from-primary-soft to-accent-soft font-bold text-fg-2',
      )}
    >
      {initials(author.displayName)}
    </span>
  );
}

/**
 * "+ Follow" / "Following" beside an author, as CoinMarketCap Community
 * shows it (D-99). Following turns into Unfollow on hover.
 */
export function FollowButton({
  name,
  following,
  pending = false,
  onToggle,
  size = 'md',
}: {
  name: string;
  following: boolean;
  pending?: boolean;
  onToggle: (active: boolean) => void;
  size?: 'sm' | 'md';
}) {
  const c = useCopy().community;
  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={formatCopy(following ? c.unfollow : c.followName, { name })}
      disabled={pending}
      onClick={() => onToggle(!following)}
      className={classNames(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-lg font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'md' ? 'h-8 px-3.5 text-xs' : 'h-7 px-2.5 text-[11px]',
        following
          ? 'border border-line-strong bg-raised text-fg-2 hover:border-negative-line hover:text-negative'
          : 'bg-primary text-white hover:enabled:opacity-90',
      )}
    >
      {following ? (
        <Check size={12} aria-hidden="true" />
      ) : (
        <Plus size={12} aria-hidden="true" />
      )}
      {following ? c.following : c.follow}
    </button>
  );
}

/** The author's Bullish or Bearish stance, as a small tag (D-99). */
export function SentimentTag({ sentiment }: { sentiment: PostSentiment }) {
  const c = useCopy().community;
  const bullish = sentiment === 'BULLISH';
  const Icon = bullish ? TrendingUp : TrendingDown;
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
        bullish
          ? 'bg-positive-soft text-positive'
          : 'bg-negative-soft text-negative',
      )}
    >
      <Icon size={11} aria-hidden="true" />
      {bullish ? c.bullish : c.bearish}
    </span>
  );
}

/**
 * The author row of CoinMarketCap Community: avatar, name with the
 * official check, @handle and age, the Influence Score under it (D-99),
 * then Follow and the menu. Hidden (BR-47) and pinned show as tags.
 */
export function PostByline({
  post,
  pinned = false,
  follow,
  trailing,
}: {
  post: Pick<
    PostSummary,
    | 'author'
    | 'authorStanding'
    | 'official'
    | 'officialCategory'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
  >;
  pinned?: boolean;
  /** The Follow button; absent on the reader's own and official posts. */
  follow?: ReactNode;
  trailing?: ReactNode;
}) {
  const copy = useCopy();
  const c = copy.community;
  const name = post.author.displayName ?? c.noName;
  const handle = handleOf(post.author.displayName);
  return (
    <div className="flex items-start gap-3">
      <Link
        to={memberPath(post.author.userId)}
        tabIndex={-1}
        aria-hidden="true"
      >
        <AuthorAvatar author={post.author} size={40} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link
            to={memberPath(post.author.userId)}
            className="min-w-0 truncate font-semibold text-fg no-underline hover:text-primary"
          >
            {name}
          </Link>
          {post.official && (
            <BadgeCheck
              size={15}
              aria-label={c.official}
              className="shrink-0 text-primary"
            />
          )}
          {handle && !post.official && (
            <span className="hidden min-w-0 shrink-[2] truncate text-muted-x sm:inline">
              {handle}
            </span>
          )}
          <span aria-hidden="true" className="text-muted-x">
            ·
          </span>
          <time
            dateTime={post.createdAt}
            title={formatInstantUtc(post.createdAt)}
            className="shrink-0 text-muted-x"
          >
            {postAge(copy, post.createdAt)}
          </time>
          {wasEdited(post.createdAt, post.updatedAt) && (
            <span
              className="shrink-0 text-[11px] text-muted-dim"
              title={formatInstantUtc(post.updatedAt)}
            >
              · {c.edited}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-dim">
          {post.official ? (
            <>
              <span className="font-semibold text-primary">{c.official}</span>
              {post.officialCategory && (
                <Badge tone="info">
                  {c[`category${post.officialCategory}`]}
                </Badge>
              )}
            </>
          ) : (
            <span>
              {formatCopy(c.influenceScore, {
                score: formatScore(post.authorStanding.influenceScore),
              })}
            </span>
          )}
          {pinned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-accent uppercase">
              <Pin size={10} aria-hidden="true" />
              {c.pinned}
            </span>
          )}
          {post.status === 'HIDDEN' && (
            <Badge tone="warning">
              <EyeOff size={10} aria-hidden="true" />
              {c.hidden}
            </Badge>
          )}
        </div>
      </div>
      {follow}
      {trailing}
    </div>
  );
}

/**
 * The text with each `$COIN` as a link to that coin's feed, as the cards
 * of CoinMarketCap Community highlight cashtags.
 */
export function PostText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p className={className}>
      {splitCashtags(text).map((part, index) =>
        part.kind === 'text' ? (
          part.text
        ) : (
          <Link
            key={index}
            to={'/community?coin=' + encodeURIComponent(part.coin)}
            className="font-semibold text-primary no-underline hover:underline"
          >
            ${part.coin}
          </Link>
        ),
      )}
    </p>
  );
}

/**
 * Coin chips with the 24h change when the screen has live prices; each
 * opens the feed filtered by its coin. The market shows as a badge.
 */
export function CoinTags({
  coins,
  market,
}: {
  coins: readonly string[];
  market: PostSummary['market'];
}) {
  const copy = useCopy();
  const { quotes } = useCoinPrices();
  if (coins.length === 0 && !market) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {coins.map((coin) => {
        const quote = quotes.get(coin);
        const change = quote?.ticker?.changePercent24h ?? null;
        const up = change !== null && !change.startsWith('-');
        return (
          <li key={coin}>
            <Link
              to={'/community?coin=' + encodeURIComponent(coin)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-semibold text-fg-2 no-underline hover:border-primary-line"
            >
              {quote?.pair.logoUrl ? (
                <img
                  src={quote.pair.logoUrl}
                  alt=""
                  className="size-3.5 rounded-full"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-primary"
                />
              )}
              {coin}
              {change !== null && (
                <span
                  className={classNames(
                    'font-mono',
                    up ? 'text-positive' : 'text-negative',
                  )}
                >
                  {up ? '▲' : '▼'} {toFixedDecimal(change.replace(/^-/, ''), 2)}
                  %
                </span>
              )}
            </Link>
          </li>
        );
      })}
      {market && (
        <li>
          <Badge>
            {market === 'spot'
              ? copy.community.marketSpot
              : copy.community.marketFutures}
          </Badge>
        </li>
      )}
    </ul>
  );
}
