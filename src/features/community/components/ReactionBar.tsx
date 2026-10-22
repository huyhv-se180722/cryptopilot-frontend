import { Link } from 'react-router-dom';
import { Bookmark, MessageSquare, ThumbsUp } from 'lucide-react';
import { useCopy } from '../../../hooks/use-copy';
import type { PostSummary } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';

const chip =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-10';

/**
 * Figma reaction row: like, comments, save (BR-45). The counts are the
 * server's; a Guest's click asks them to sign in (D-99).
 */
export function ReactionBar({
  post,
  commentsTo,
  onReact,
  pending = false,
}: {
  post: Pick<
    PostSummary,
    'likeCount' | 'commentCount' | 'likedByMe' | 'savedByMe'
  >;
  /** Where the comment count leads (the post, or its comment box). */
  commentsTo: string;
  onReact: (action: 'like' | 'save', active: boolean) => void;
  pending?: boolean;
}) {
  const c = useCopy().community;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={post.likedByMe}
        aria-label={post.likedByMe ? c.unlike : c.like}
        title={post.likedByMe ? c.unlike : c.like}
        disabled={pending}
        onClick={() => onReact('like', !post.likedByMe)}
        className={classNames(
          chip,
          post.likedByMe
            ? 'border-positive-line bg-positive-soft text-positive'
            : 'border-line bg-raised text-muted-x hover:enabled:border-positive-line hover:enabled:text-positive',
        )}
      >
        <ThumbsUp
          size={12}
          aria-hidden="true"
          fill={post.likedByMe ? 'currentColor' : 'none'}
        />
        <span className="font-mono">{post.likeCount}</span>
      </button>
      <Link
        to={commentsTo}
        aria-label={c.comments}
        title={c.comments}
        className={classNames(
          chip,
          'border-line bg-raised text-muted-x no-underline hover:border-primary-line hover:text-primary',
        )}
      >
        <MessageSquare size={12} aria-hidden="true" />
        <span className="font-mono">{post.commentCount}</span>
      </Link>
      <button
        type="button"
        aria-pressed={post.savedByMe}
        aria-label={post.savedByMe ? c.unsave : c.save}
        title={post.savedByMe ? c.unsave : c.save}
        disabled={pending}
        onClick={() => onReact('save', !post.savedByMe)}
        className={classNames(
          chip,
          'ml-auto',
          post.savedByMe
            ? 'border-primary-line bg-primary-soft text-primary'
            : 'border-line bg-raised text-muted-x hover:enabled:border-primary-line hover:enabled:text-primary',
        )}
      >
        <Bookmark
          size={12}
          aria-hidden="true"
          fill={post.savedByMe ? 'currentColor' : 'none'}
        />
      </button>
    </div>
  );
}
