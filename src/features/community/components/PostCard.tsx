import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PostSummary } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { postPath } from './post-format';
import { PostCover } from './PostMediaView';
import { CoinTags, PostByline } from './PostParts';
import { ReactionBar } from './ReactionBar';

/**
 * Figma community card (SCR-24): author row, title, excerpt, media
 * preview, coin tags and reactions. Official posts carry the stronger
 * border of the prototype's pinned card.
 */
export function PostCard({
  post,
  pinned = false,
  menu,
  onReact,
  pending,
}: {
  post: PostSummary;
  pinned?: boolean;
  menu?: ReactNode;
  onReact: (action: 'like' | 'save', active: boolean) => void;
  pending?: boolean;
}) {
  const to = postPath(post.id);
  return (
    <article
      aria-labelledby={'post-' + post.id}
      className={classNames(
        'rounded-2xl border bg-surface p-4 transition-colors duration-150 hover:border-line-strong sm:p-5',
        post.official
          ? 'border-line-strong shadow-(--cp-shadow-panel)'
          : 'border-line',
      )}
    >
      <PostByline post={post} pinned={pinned} trailing={menu} />
      <h3
        id={'post-' + post.id}
        className="mt-3 text-sm leading-snug font-semibold text-fg"
      >
        <Link
          to={to}
          className="text-fg no-underline hover:text-primary focus-visible:text-primary"
        >
          {post.title}
        </Link>
      </h3>
      {post.excerpt && (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed break-words whitespace-pre-line text-muted-dim">
          {post.excerpt}
        </p>
      )}
      {post.cover && (
        <Link to={to} tabIndex={-1} aria-hidden="true">
          <PostCover cover={post.cover} />
        </Link>
      )}
      {(post.coins.length > 0 || post.market) && (
        <div className="mt-3">
          <CoinTags coins={post.coins} market={post.market} />
        </div>
      )}
      <div className="mt-3 border-t border-line pt-3">
        <ReactionBar
          post={post}
          commentsTo={to + '#comments'}
          onReact={onReact}
          pending={pending ?? false}
        />
      </div>
    </article>
  );
}
