import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Megaphone,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { Influencer, InfluencerRank } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { useInfluencers, usePinnedPosts } from '../hooks/use-community';
import { formatScore, memberPath, postAge, postPath } from './post-format';
import { AuthorAvatar } from './PostParts';

const panel = 'rounded-2xl border border-line bg-surface';

/**
 * The banner at the top of the right column, where CoinMarketCap shows
 * its past Lives: here the CryptoPilot team's pinned posts (BR-61), one at
 * a time, 1/3 with arrows, See All opening Articles.
 */
export function PinnedCarousel() {
  const copy = useCopy();
  const c = copy.community;
  const pinned = usePinnedPosts();
  const [index, setIndex] = useState(0);
  const items = pinned.data?.items ?? [];
  if (pinned.isPending)
    return <Skeleton className="h-[132px] w-full rounded-2xl" />;
  if (items.length === 0) return null;
  const at = Math.min(index, items.length - 1);
  const post = items[at];
  if (!post) return null;
  return (
    <section aria-labelledby="community-pinned">
      <Link
        to={postPath(post.id)}
        className="block rounded-2xl border border-primary-line bg-linear-135 from-primary-soft via-surface to-accent-soft p-4 no-underline transition-colors duration-150 hover:border-primary"
      >
        <h2
          id="community-pinned"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"
        >
          <Megaphone size={12} aria-hidden="true" className="text-primary" />
          {c.announcementsTitle}
          <ChevronRight size={12} aria-hidden="true" />
        </h2>
        <p className="mt-2 line-clamp-2 text-[15px] leading-snug font-semibold text-fg">
          {post.title}
        </p>
        <p className="mt-2 text-[11px] text-muted-dim">
          {post.officialCategory && c[`category${post.officialCategory}`]} ·{' '}
          {postAge(copy, post.createdAt)}
        </p>
      </Link>
      <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-x">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={c.carouselPrev}
            disabled={at === 0}
            onClick={() => setIndex(at - 1)}
            className="inline-flex size-6 items-center justify-center rounded-md hover:bg-raised disabled:opacity-40"
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>
          <span aria-live="polite">
            {formatCopy(c.carouselPosition, {
              n: at + 1,
              total: items.length,
            })}
          </span>
          <button
            type="button"
            aria-label={c.carouselNext}
            disabled={at >= items.length - 1}
            onClick={() => setIndex(at + 1)}
            className="inline-flex size-6 items-center justify-center rounded-md hover:bg-raised disabled:opacity-40"
          >
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
        <Link
          to="/community/articles"
          className="font-semibold text-primary no-underline hover:underline"
        >
          {c.seeAll}
        </Link>
      </div>
    </section>
  );
}

/**
 * Top Influencers (D-99): Social Influence or Analytical Depth, each
 * member with their score and the stance of their recent posts.
 */
export function InfluencerList() {
  const c = useCopy().community;
  const [rank, setRank] = useState<InfluencerRank>('INFLUENCE');
  const list = useInfluencers(rank);
  const ranks: readonly InfluencerRank[] = ['INFLUENCE', 'DEPTH'];
  return (
    <section className={panel} aria-labelledby="community-influencers">
      <div className="flex items-center gap-1.5 px-4 pt-4">
        <UsersRound size={14} aria-hidden="true" className="text-primary" />
        <h2
          id="community-influencers"
          className="text-sm font-semibold text-fg"
        >
          {c.influencersTitle}
        </h2>
        <span title={c.influencersHint} className="text-muted-x">
          <Info size={12} aria-label={c.influencersHint} />
        </span>
      </div>
      <div role="tablist" className="flex gap-1 px-4 pt-3 pb-2">
        {ranks.map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            aria-selected={rank === each}
            onClick={() => setRank(each)}
            className={classNames(
              'h-7 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150',
              rank === each
                ? 'bg-primary-soft text-primary'
                : 'text-muted-x hover:text-fg-2',
            )}
          >
            {c[`rank${each}`]}
          </button>
        ))}
      </div>
      <ol className="pb-2">
        {list.isPending ? (
          [0, 1, 2, 3].map((n) => (
            <li key={n} className="px-4 py-2">
              <Skeleton className="h-9 w-full" />
            </li>
          ))
        ) : (list.data ?? []).length === 0 ? (
          <li className="px-4 py-3 text-xs text-muted-dim">
            {c.influencersEmpty}
          </li>
        ) : (
          (list.data ?? []).map((member) => (
            <li key={member.userId}>
              <InfluencerRow member={member} rank={rank} />
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function InfluencerRow({
  member,
  rank,
}: {
  member: Influencer;
  rank: InfluencerRank;
}) {
  const c = useCopy().community;
  const name = member.displayName ?? c.noName;
  const score = rank === 'DEPTH' ? member.depthScore : member.influenceScore;
  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
      <Link to={memberPath(member.userId)} tabIndex={-1} aria-hidden="true">
        <AuthorAvatar author={member} size={30} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={memberPath(member.userId)}
          className="block truncate text-xs font-semibold text-fg no-underline hover:text-primary"
        >
          {name}
        </Link>
        <span className="block text-[11px] text-muted-dim">
          {formatCopy(rank === 'DEPTH' ? c.depthScore : c.influenceScore, {
            score: formatScore(score),
          })}
        </span>
      </div>
      <Stance bullish={member.bullishPosts} bearish={member.bearishPosts} />
    </div>
  );
}

/**
 * Which way a member's posts of the last 30 days lean: Neutral when they
 * marked as many Bullish as Bearish, else the side and its share, with
 * the bar CoinMarketCap draws under it.
 */
function Stance({ bullish, bearish }: { bullish: number; bearish: number }) {
  const c = useCopy().community;
  const total = bullish + bearish;
  const side =
    bullish > bearish ? 'bull' : bearish > bullish ? 'bear' : 'neutral';
  const share = total === 0 ? 50 : Math.round((bullish / total) * 100);
  return (
    <div className="w-16 shrink-0 text-right">
      <span
        className={classNames(
          'inline-flex items-center gap-0.5 text-[11px] font-semibold',
          side === 'bull'
            ? 'text-positive'
            : side === 'bear'
              ? 'text-negative'
              : 'text-muted-x',
        )}
      >
        {side === 'bull' && <TrendingUp size={11} aria-hidden="true" />}
        {side === 'bear' && <TrendingDown size={11} aria-hidden="true" />}
        {side === 'neutral'
          ? c.neutral
          : side === 'bull'
            ? c.bullish
            : c.bearish}
      </span>
      <span
        aria-hidden="true"
        className="mt-1 flex h-1 overflow-hidden rounded-full bg-negative/60"
      >
        <span className="bg-positive" style={{ width: share + '%' }} />
      </span>
    </div>
  );
}
