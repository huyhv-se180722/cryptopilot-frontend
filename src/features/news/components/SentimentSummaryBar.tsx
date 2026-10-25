import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import type { NewsSentiment } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { useSentimentSummary } from '../hooks/use-news';
import { SENTIMENTS, sentimentLabel } from './news-format';

const BAR: Record<NewsSentiment, string> = {
  BULLISH: 'bg-positive',
  NEUTRAL: 'bg-muted-dim',
  BEARISH: 'bg-negative',
};
const TEXT: Record<NewsSentiment, string> = {
  BULLISH: 'text-positive',
  NEUTRAL: 'text-fg-2',
  BEARISH: 'text-negative',
};

/**
 * The SRS 3.8.1 summary bar: how many articles of the last 24 hours are
 * bullish, neutral and bearish. Each count filters the feed by its
 * sentiment; the counts are always written out, never color alone.
 */
export function SentimentSummaryBar({
  selected,
  onSelect,
}: {
  selected: NewsSentiment | '';
  onSelect: (sentiment: NewsSentiment | '') => void;
}) {
  const copy = useCopy();
  const n = copy.news;
  const query = useSentimentSummary();

  if (query.isPending) return <Skeleton className="mb-4 h-20 w-full" />;
  if (query.isError)
    return (
      <p className="mb-4 rounded-xl border border-line bg-surface p-4 text-xs text-muted">
        {errorText(copy, query.error)}
      </p>
    );

  const counts: Record<NewsSentiment, number> = {
    BULLISH: query.data.bullish,
    NEUTRAL: query.data.neutral,
    BEARISH: query.data.bearish,
  };
  const total = counts.BULLISH + counts.NEUTRAL + counts.BEARISH;

  return (
    <section
      aria-label={n.summaryLabel}
      className="mb-4 rounded-xl border border-line bg-surface p-4"
    >
      <h2 className="mb-3 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
        {n.summaryTitle}
      </h2>
      {total === 0 ? (
        <p className="text-xs text-muted">{n.summaryEmpty}</p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-raised"
          >
            {SENTIMENTS.map((s) => (
              <span
                key={s}
                className={BAR[s]}
                style={{ width: `${(counts[s] / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SENTIMENTS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={selected === s}
                onClick={() => onSelect(selected === s ? '' : s)}
                className={classNames(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  selected === s
                    ? 'border-primary-line bg-primary-soft'
                    : 'border-line bg-raised hover:border-primary-line',
                )}
              >
                <span className="block text-[11px] text-muted-dim">
                  {sentimentLabel(copy, s)}
                </span>
                <span
                  className={classNames(
                    'block font-mono text-sm font-semibold tabular-nums',
                    TEXT[s],
                  )}
                >
                  {formatCopy(n.summaryCount, { n: counts[s] })}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
