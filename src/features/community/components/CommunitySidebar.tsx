import { Link } from 'react-router-dom';
import { MessageSquare, ShieldCheck, Zap } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { CoinDiscussion } from '../../../types/domain';
import { formatInstantUtc } from '../../../utils/instant-format';
import { postAge } from './post-format';

const panel = 'rounded-2xl border border-line bg-surface p-4';
const heading =
  'mb-3 text-[10px] font-semibold tracking-widest text-muted-x uppercase';

/**
 * The discussion of the filtered coin (D-99): posts in 24 hours, 7 days
 * and in all, and the latest post's age — the values the backend gives,
 * in place of the prototype's member and online counts.
 */
export function CoinDiscussionCard({
  symbol,
  discussion,
  loading,
}: {
  symbol: string;
  discussion: CoinDiscussion | undefined;
  loading: boolean;
}) {
  const copy = useCopy();
  const c = copy.community;
  const rows = discussion
    ? [
        { label: c.discussionDay, value: String(discussion.postsLastDay) },
        { label: c.discussionWeek, value: String(discussion.postsLastWeek) },
        { label: c.discussionTotal, value: String(discussion.totalPosts) },
      ]
    : [];
  return (
    <section className={panel} aria-labelledby="coin-discussion">
      <h2 id="coin-discussion" className={heading}>
        {formatCopy(c.discussionTitle, { coin: '$' + symbol })}
      </h2>
      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : discussion ? (
        <dl>
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-line py-2 text-xs"
            >
              <dt className="flex items-center gap-2 text-muted-dim">
                <MessageSquare
                  size={12}
                  aria-hidden="true"
                  className="text-primary"
                />
                {row.label}
              </dt>
              <dd className="font-mono font-semibold text-fg-2">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 text-xs">
            <dt className="text-muted-dim">{c.discussionLast}</dt>
            <dd className="text-fg-2">
              {discussion.lastPostAt ? (
                <time
                  dateTime={discussion.lastPostAt}
                  title={formatInstantUtc(discussion.lastPostAt)}
                >
                  {postAge(copy, discussion.lastPostAt)}
                </time>
              ) : (
                c.discussionNone
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-xs text-muted-dim">{c.discussionNone}</p>
      )}
    </section>
  );
}

export function RulesCard() {
  const c = useCopy().community;
  return (
    <section className={panel} aria-labelledby="community-rules">
      <h2
        id="community-rules"
        className={heading + ' flex items-center gap-1.5'}
      >
        <ShieldCheck size={12} aria-hidden="true" className="text-primary" />
        {c.rulesTitle}
      </h2>
      <p className="text-[11px] leading-relaxed text-muted-dim">
        {c.rulesBody}
      </p>
    </section>
  );
}

/** Figma "Join the conversation" card for Guests (D-99). */
export function JoinCard() {
  const c = useCopy().community;
  return (
    <section className="rounded-2xl border border-line-strong bg-linear-135 from-primary-soft to-accent-soft p-4">
      <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-fg">
        <Zap size={13} aria-hidden="true" className="text-accent" />
        {c.signInTitle}
      </h2>
      <p className="mb-4 text-[11px] leading-relaxed text-muted-dim">
        {c.signInBody}
      </p>
      <Link
        to="/register"
        state={{ from: '/community' }}
        className={buttonClassName('primary', 'md', 'w-full')}
      >
        {c.register}
      </Link>
      <Link
        to="/login"
        state={{ from: '/community' }}
        className={buttonClassName('ghost', 'md', 'mt-2 w-full')}
      >
        {c.signIn}
      </Link>
    </section>
  );
}
