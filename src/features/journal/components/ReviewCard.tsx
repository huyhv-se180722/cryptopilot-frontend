import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { JournalEntry } from '../../../types/domain';

function ReviewText({ label, text }: { label: string; text: string | null }) {
  if (text === null) return null;
  return (
    <div>
      <h3 className="mb-1 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
        {label}
      </h3>
      <p className="m-0 text-xs leading-relaxed whitespace-pre-line text-fg-2">
        {text}
      </p>
    </div>
  );
}

/** The review of a trade as saved (SCR-21, UC-23). */
export function ReviewView({
  entry,
  symbol,
}: {
  entry: JournalEntry;
  symbol: string;
}) {
  const j = useCopy().journal;
  const empty =
    entry.strategyName === null &&
    entry.setupDescription === null &&
    entry.lessonsLearned === null &&
    entry.mistakes === null &&
    entry.chartImageUrl === null;
  if (empty) return <p className="m-0 text-xs text-muted">{j.reviewEmpty}</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-xs text-muted-dim">
        {j.strategy}:{' '}
        <span className="font-medium text-fg-2">
          {entry.strategyName ?? j.strategyNone}
        </span>
      </p>
      <ReviewText label={j.setupDescription} text={entry.setupDescription} />
      <ReviewText label={j.lessonsLearned} text={entry.lessonsLearned} />
      <ReviewText label={j.mistakes} text={entry.mistakes} />
      {entry.chartImageUrl && (
        <figure className="m-0">
          <figcaption className="mb-1 text-[10px] font-semibold tracking-widest text-muted-x uppercase">
            {j.chartImage}
          </figcaption>
          <a href={entry.chartImageUrl} target="_blank" rel="noreferrer">
            <img
              src={entry.chartImageUrl}
              alt={formatCopy(j.chartImageAlt, { symbol })}
              loading="lazy"
              className="max-h-80 w-full rounded-lg border border-line object-contain"
            />
          </a>
        </figure>
      )}
    </div>
  );
}
