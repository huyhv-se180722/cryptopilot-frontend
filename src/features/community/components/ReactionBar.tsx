import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Eye,
  Heart,
  MessageSquare,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import type { PostSentiment, PostSummary } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { compactCount } from './post-format';

const pill =
  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-9';
const stat =
  'inline-flex h-8 items-center gap-1.5 rounded-lg px-1.5 text-xs text-muted-x no-underline transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-10';

type Reactable = Pick<
  PostSummary,
  | 'likeCount'
  | 'commentCount'
  | 'viewCount'
  | 'bullishCount'
  | 'bearishCount'
  | 'myVote'
  | 'likedByMe'
  | 'savedByMe'
>;

/**
 * The reactions of a CoinMarketCap Community card: Bullish and Bearish
 * votes and the like (D-99, BR-45), then the views, comments, save and
 * the ⋯ menu. Counts are the server's; a Guest's click asks them to sign
 * in.
 */
export function ReactionBar({
  post,
  commentsTo,
  onReact,
  onVote,
  menu,
  pending = false,
}: {
  post: Reactable;
  /** Where the comment count leads (the post, or its comment box). */
  commentsTo: string;
  onReact: (action: 'like' | 'save', active: boolean) => void;
  onVote: (sentiment: PostSentiment | null) => void;
  menu?: ReactNode;
  pending?: boolean;
}) {
  const c = useCopy().community;
  const vote = (sentiment: PostSentiment) =>
    onVote(post.myVote === sentiment ? null : sentiment);
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={post.myVote === 'BULLISH'}
          aria-label={post.myVote === 'BULLISH' ? c.unvote : c.voteBullish}
          title={c.bullish}
          disabled={pending}
          onClick={() => vote('BULLISH')}
          className={classNames(
            pill,
            post.myVote === 'BULLISH'
              ? 'border-positive-line bg-positive-soft text-positive'
              : 'border-line bg-raised text-muted-x hover:enabled:border-positive-line hover:enabled:text-positive',
          )}
        >
          <TrendingUp size={13} aria-hidden="true" />
          <span className="font-mono">{post.bullishCount}</span>
        </button>
        <button
          type="button"
          aria-pressed={post.myVote === 'BEARISH'}
          aria-label={post.myVote === 'BEARISH' ? c.unvote : c.voteBearish}
          title={c.bearish}
          disabled={pending}
          onClick={() => vote('BEARISH')}
          className={classNames(
            pill,
            post.myVote === 'BEARISH'
              ? 'border-negative-line bg-negative-soft text-negative'
              : 'border-line bg-raised text-muted-x hover:enabled:border-negative-line hover:enabled:text-negative',
          )}
        >
          <TrendingDown size={13} aria-hidden="true" />
          <span className="font-mono">{post.bearishCount}</span>
        </button>
        <button
          type="button"
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? c.unlike : c.like}
          title={post.likedByMe ? c.unlike : c.like}
          disabled={pending}
          onClick={() => onReact('like', !post.likedByMe)}
          className={classNames(
            pill,
            post.likedByMe
              ? 'border-negative-line bg-negative-soft text-negative'
              : 'border-line bg-raised text-muted-x hover:enabled:border-negative-line hover:enabled:text-negative',
          )}
        >
          <Heart
            size={13}
            aria-hidden="true"
            fill={post.likedByMe ? 'currentColor' : 'none'}
          />
          <span className="font-mono">{post.likeCount}</span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className={stat} title={c.views}>
          <Eye size={15} aria-hidden="true" />
          <span className="sr-only">{c.views}</span>
          <span className="font-mono">{compactCount(post.viewCount)}</span>
        </span>
        <Link
          to={commentsTo}
          aria-label={c.comments}
          title={c.comments}
          className={classNames(stat, 'hover:text-primary')}
        >
          <MessageSquare size={15} aria-hidden="true" />
          <span className="font-mono">{compactCount(post.commentCount)}</span>
        </Link>
        <button
          type="button"
          aria-pressed={post.savedByMe}
          aria-label={post.savedByMe ? c.unsave : c.save}
          title={post.savedByMe ? c.unsave : c.save}
          disabled={pending}
          onClick={() => onReact('save', !post.savedByMe)}
          className={classNames(
            stat,
            post.savedByMe ? 'text-primary' : 'hover:enabled:text-primary',
          )}
        >
          <Bookmark
            size={15}
            aria-hidden="true"
            fill={post.savedByMe ? 'currentColor' : 'none'}
          />
        </button>
        {menu && <span className="ml-auto">{menu}</span>}
      </div>
    </div>
  );
}
