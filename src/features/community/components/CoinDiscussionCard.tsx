import { Link } from 'react-router-dom';
import { MessageSquare, PenSquare } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import { formatInstantUtc } from '../../../utils/instant-format';
import { useCoinDiscussion } from '../hooks/use-community';
import { postAge } from './post-format';

/**
 * How much the community talks about a coin (D-99 CF-01b, "coin-related
 * discussions"): posts in 24 hours, 7 days and in all, and the latest
 * post's age, as the backend counts them. With `links` it also opens the
 * coin's feed and a new post tagged with the coin (SCR-10, SCR-11).
 */
export function CoinDiscussionCard({
  coin,
  links = false,
}: {
  coin: string;
  links?: boolean;
}) {
  const copy = useCopy();
  const c = copy.community;
  const query = useCoinDiscussion(coin);
  const discussion = query.data;
  // A coin the backend does not know has no discussion (MSG41); any other
  // failure says what went wrong.
  const failure =
    query.isError && problemOf(query.error)?.status !== 404
      ? errorText(copy, query.error)
      : null;
  const rows = discussion
    ? [
        { label: c.discussionDay, value: discussion.postsLastDay },
        { label: c.discussionWeek, value: discussion.postsLastWeek },
        { label: c.discussionTotal, value: discussion.totalPosts },
      ]
    : [];
  const encoded = encodeURIComponent(coin);

  return (
    <section
      className="rounded-2xl border border-line bg-surface p-4"
      aria-labelledby="coin-discussion"
    >
      <h2
        id="coin-discussion"
        className="mb-3 text-[10px] font-semibold tracking-widest text-muted-x uppercase"
      >
        {formatCopy(c.discussionTitle, { coin: '$' + coin })}
      </h2>
      {query.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : failure ? (
        <p className="text-xs text-muted-dim">{failure}</p>
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
      {links && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            to={'/community?coin=' + encoded}
            className={buttonClassName('secondary', 'sm', 'w-full')}
          >
            <MessageSquare size={12} aria-hidden="true" />
            {c.discussionOpen}
          </Link>
          <Link
            to={'/community/new?coin=' + encoded}
            className={buttonClassName('secondary', 'sm', 'w-full')}
          >
            <PenSquare size={12} aria-hidden="true" />
            {formatCopy(c.discussionWrite, { coin })}
          </Link>
        </div>
      )}
    </section>
  );
}
