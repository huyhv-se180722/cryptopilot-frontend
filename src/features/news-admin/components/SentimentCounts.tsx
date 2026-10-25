import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { classNames } from '../../../utils/class-names';
import { useSentimentCounts } from '../hooks/use-news-admin';

const SENTIMENTS = [
  {
    key: 'bullish',
    label: 'sentimentBULLISH',
    bar: 'bg-positive',
    text: 'text-positive',
  },
  {
    key: 'neutral',
    label: 'sentimentNEUTRAL',
    bar: 'bg-muted-x',
    text: 'text-fg-2',
  },
  {
    key: 'bearish',
    label: 'sentimentBEARISH',
    bar: 'bg-negative',
    text: 'text-negative',
  },
] as const;

/**
 * The tone of the feed over the last 24 hours (D-126): how many shown
 * articles the AI labelled bullish, neutral and bearish, as counts, shares
 * and one proportion bar. It is the administrators' view; Traders see each
 * article's label only.
 */
export function SentimentCounts() {
  const copy = useCopy();
  const n = copy.newsAdmin;
  const query = useSentimentCounts();

  return (
    <section
      aria-label={n.sentimentTitle}
      className="mb-4 rounded-xl border border-line bg-surface p-4"
    >
      <h2 className="text-[10px] font-semibold tracking-widest text-muted-x uppercase">
        {n.sentimentTitle}
      </h2>
      <p className="mt-0.5 mb-3 text-[11px] text-muted-dim">
        {n.sentimentHint}
      </p>
      {query.isPending ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : query.isError ? (
        <p className="text-xs text-muted">{n.sentimentError}</p>
      ) : (
        (() => {
          const counts = query.data;
          const total = counts.bullish + counts.neutral + counts.bearish;
          if (total === 0)
            return <p className="text-xs text-muted">{n.sentimentEmpty}</p>;
          const share = (value: number) => Math.round((value * 100) / total);
          return (
            <>
              <div
                aria-hidden="true"
                className="mb-3 flex h-2 overflow-hidden rounded-full bg-raised"
              >
                {SENTIMENTS.map((s) => (
                  <span
                    key={s.key}
                    className={s.bar}
                    style={{ width: (counts[s.key] * 100) / total + '%' }}
                  />
                ))}
              </div>
              <dl className="grid grid-cols-3 gap-3">
                {SENTIMENTS.map((s) => (
                  <div key={s.key}>
                    <dt className="text-[11px] text-muted-dim">{n[s.label]}</dt>
                    <dd
                      className={classNames(
                        'text-lg font-bold tabular-nums',
                        s.text,
                      )}
                    >
                      {counts[s.key]}
                    </dd>
                    <dd className="text-[11px] text-muted-dim">
                      {formatCopy(n.sentimentShare, {
                        n: counts[s.key],
                        share: share(counts[s.key]),
                      })}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          );
        })()
      )}
    </section>
  );
}
