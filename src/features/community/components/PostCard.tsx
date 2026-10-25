import { Link } from 'react-router-dom';
import type { PostSummary } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { postPath } from './post-format';
import { PostCover } from './PostMediaView';
import {
  CoinTags,
  FollowButton,
  PostByline,
  PostText,
  SentimentTag,
} from './PostParts';
import { ReactionBar } from './ReactionBar';
import type { PostActions } from './use-post-interactions';

/**
 * A card of CoinMarketCap Community (SCR-24, D-99): the author with their
 * Influence Score and Follow, the title, the text with its cashtags, the
 * media, the coins with their 24h change, the votes and the stats row.
 * Official posts carry the stronger border of a pinned card.
 */
export function PostCard({
  post,
  pinned = false,
  actions,
}: {
  post: PostSummary;
  pinned?: boolean;
  actions: PostActions;
}) {
  const to = postPath(post.id);
  const mine = actions.isMine(post);
  const name = post.author.displayName ?? '';
  return (
    <article
      aria-labelledby={'post-' + post.id}
      className={classNames(
        'flex min-w-0 flex-col rounded-2xl border bg-surface p-4 transition-colors duration-150 hover:border-line-strong sm:p-5',
        post.official
          ? 'border-line-strong shadow-(--cp-shadow-panel)'
          : 'border-line',
      )}
    >
      <PostByline
        post={post}
        pinned={pinned}
        {...(!mine && !post.official && actions.role !== 'other'
          ? {
              follow: (
                <FollowButton
                  name={name}
                  following={post.authorStanding.followedByMe}
                  pending={actions.following}
                  onToggle={(active) =>
                    void actions.follow(post.author.userId, active)
                  }
                />
              ),
            }
          : {})}
      />
      <h3 className="mt-3 flex items-start gap-2 text-[15px] leading-snug font-semibold text-fg">
        <Link
          id={'post-' + post.id}
          to={to}
          className="min-w-0 text-fg no-underline hover:text-primary focus-visible:text-primary"
        >
          {post.title}
        </Link>
        {post.sentiment && <SentimentTag sentiment={post.sentiment} />}
      </h3>
      {post.excerpt && (
        <PostText
          text={post.excerpt}
          className="mt-1.5 line-clamp-4 text-sm leading-relaxed break-words whitespace-pre-line text-fg-2"
        />
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
      <div className="mt-auto pt-3">
        <ReactionBar
          post={post}
          commentsTo={to + '#comments'}
          onReact={(action, active) =>
            void actions.react(post.id, action, active)
          }
          onVote={(sentiment) => void actions.vote(post.id, sentiment)}
          menu={actions.menu(post)}
          pending={actions.reacting || actions.voting}
        />
      </div>
    </article>
  );
}
