import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, Pin, Shield } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { useCopy } from '../../../hooks/use-copy';
import type { PostAuthor, PostSummary } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { formatInstantUtc } from '../../../utils/instant-format';
import { initials, memberPath, postAge, wasEdited } from './post-format';

/** Figma author avatar: 30px circle, initials when there is no picture. */
export function AuthorAvatar({
  author,
  size = 30,
}: {
  author: Pick<PostAuthor, 'displayName' | 'avatarUrl'>;
  size?: 24 | 30 | 56;
}) {
  const box = {
    24: 'size-6 text-[9px]',
    30: 'size-[30px] text-[10px]',
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
        'flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-raised font-bold text-fg-2',
      )}
    >
      {initials(author.displayName)}
    </span>
  );
}

/**
 * Figma author row: avatar, name (to the member page, D-99), Official and
 * category for announcements, pinned, hidden (BR-47) and the post's age.
 */
export function PostByline({
  post,
  pinned = false,
  trailing,
}: {
  post: Pick<
    PostSummary,
    | 'author'
    | 'official'
    | 'officialCategory'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
  >;
  pinned?: boolean;
  trailing?: ReactNode;
}) {
  const copy = useCopy();
  const c = copy.community;
  const name = post.author.displayName ?? c.noName;
  return (
    <div className="flex items-center gap-2.5">
      <AuthorAvatar author={post.author} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={memberPath(post.author.userId)}
            className="truncate text-xs font-semibold text-fg-2 no-underline hover:text-primary"
          >
            {name}
          </Link>
          {post.official && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              <Shield size={10} aria-hidden="true" />
              {c.official}
            </span>
          )}
          {post.officialCategory && (
            <Badge tone="info">{c[`category${post.officialCategory}`]}</Badge>
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
        <div className="mt-0.5 text-[11px] text-muted-x">
          <time
            dateTime={post.createdAt}
            title={formatInstantUtc(post.createdAt)}
          >
            {postAge(copy, post.createdAt)}
          </time>
          {wasEdited(post.createdAt, post.updatedAt) && (
            <span title={formatInstantUtc(post.updatedAt)}> · {c.edited}</span>
          )}
        </div>
      </div>
      {trailing}
    </div>
  );
}

/** `$BTC` chips; each opens the feed filtered by its coin. */
export function CoinTags({
  coins,
  market,
}: {
  coins: readonly string[];
  market: PostSummary['market'];
}) {
  const copy = useCopy();
  if (coins.length === 0 && !market) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {coins.map((coin) => (
        <li key={coin}>
          <Link
            to={'/community?coin=' + encodeURIComponent(coin)}
            className="rounded-full border border-line bg-raised px-2 py-0.5 font-mono text-[11px] font-semibold text-primary no-underline hover:border-primary-line"
          >
            ${coin}
          </Link>
        </li>
      ))}
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
