import { useId, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Alert } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { JournalEntry } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { useSaveReview, useStrategies } from '../hooks/use-journal-entry';
import { ChartImageField } from './ChartImageField';

/** The backend's limit of each review text (UC-23). */
export const REVIEW_TEXT_MAX = 4000;

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

/** A review text with its counter; the browser stops at the limit. */
export function ReviewTextField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  const id = useId();
  const j = useCopy().journal;
  return (
    <div>
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        maxLength={REVIEW_TEXT_MAX}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={id + '-note'}
        className={classNames(fieldControlClass, 'resize-y text-xs')}
      />
      <span
        id={id + '-note'}
        className={classNames(
          error ? fieldErrorClass : fieldHintClass,
          'flex justify-between gap-2',
        )}
      >
        <span>{error}</span>
        <span className="font-mono text-muted-x">
          {formatCopy(j.textCount, {
            count: value.length,
            max: REVIEW_TEXT_MAX,
          })}
        </span>
      </span>
    </div>
  );
}

const blankToNull = (value: string) => (value.trim() === '' ? null : value);

/**
 * The review of SCR-21 with its editor (UC-23). The backend replaces the
 * whole review, so the form sends every field again: the strategy and
 * the image are kept unless changed. An image whose key cannot be read
 * back from its address (Q-97) keeps the review read only, so saving
 * never removes it.
 */
export function ReviewCard({
  entry,
  symbol,
}: {
  entry: JournalEntry;
  symbol: string;
}) {
  const copy = useCopy();
  const j = copy.journal;
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const canKeepImage =
    entry.chartImageUrl === null || entry.chartImageKey !== null;
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="mr-auto text-[10px] font-semibold tracking-widest text-muted-x uppercase">
          {j.reviewTitle}
        </h2>
        {!editing && canKeepImage && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil size={13} aria-hidden="true" />
            {j.reviewEdit}
          </Button>
        )}
      </div>
      {!canKeepImage && (
        <p className="mb-3 text-[11px] text-muted-dim">{j.reviewImageLocked}</p>
      )}
      {editing ? (
        <ReviewForm
          entry={entry}
          symbol={symbol}
          onDone={(saved) => {
            setEditing(false);
            if (saved)
              show({ tone: 'success', message: messageText(copy, 'MSG14') });
          }}
        />
      ) : (
        <ReviewView entry={entry} symbol={symbol} />
      )}
    </>
  );
}

const FIELDS = [
  'strategyId',
  'setupDescription',
  'lessonsLearned',
  'mistakes',
  'chartImagePublicId',
] as const;

function ReviewForm({
  entry,
  symbol,
  onDone,
}: {
  entry: JournalEntry;
  symbol: string;
  onDone: (saved: boolean) => void;
}) {
  const copy = useCopy();
  const j = copy.journal;
  const strategies = useStrategies();
  const save = useSaveReview(entry.trade.id);
  const [strategyId, setStrategyId] = useState(entry.strategyId ?? '');
  const [setup, setSetup] = useState(entry.setupDescription ?? '');
  const [lessons, setLessons] = useState(entry.lessonsLearned ?? '');
  const [mistakes, setMistakes] = useState(entry.mistakes ?? '');
  const [imageKey, setImageKey] = useState(entry.chartImageKey);
  const problem = problemOf(save.error);
  const fieldErrors = problem?.fieldErrors ?? {};
  const fieldError = (name: (typeof FIELDS)[number], label: string) => {
    const id = fieldErrors[name];
    if (!id) return undefined;
    // MSG32 names the size limit the server sent with it.
    if (id === 'MSG32') return errorText(copy, save.error);
    if (id === 'MSG15' && name !== 'strategyId')
      return messageText(copy, 'MSG15', [], {
        field: label,
        min: 0,
        max: j.textLimit,
      });
    return messageText(copy, id, [], { field: label.toLowerCase() });
  };
  const fieldNamed = FIELDS.some((name) => fieldErrors[name]);
  const listed = strategies.data ?? [];
  const keepsUnlisted =
    entry.strategyId !== null &&
    !listed.some((strategy) => strategy.id === entry.strategyId);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(
          {
            strategyId: strategyId || null,
            setupDescription: blankToNull(setup),
            lessonsLearned: blankToNull(lessons),
            mistakes: blankToNull(mistakes),
            chartImageKey: imageKey,
          },
          { onSuccess: () => onDone(true) },
        );
      }}
    >
      {save.isError && !fieldNamed && (
        <Alert tone="danger" title={errorText(copy, save.error)} />
      )}
      <Select
        label={j.strategy}
        value={strategyId}
        onChange={(event) => setStrategyId(event.target.value)}
        error={fieldError('strategyId', j.strategy)}
      >
        <option value="">{j.strategyNone}</option>
        {keepsUnlisted && (
          <option value={entry.strategyId ?? ''}>
            {entry.strategyName ?? copy.market.noValue}
          </option>
        )}
        {listed.map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name}
          </option>
        ))}
      </Select>
      <ReviewTextField
        label={j.setupDescription}
        value={setup}
        onChange={setSetup}
        error={fieldError('setupDescription', j.setupDescription)}
      />
      <ReviewTextField
        label={j.lessonsLearned}
        value={lessons}
        onChange={setLessons}
        error={fieldError('lessonsLearned', j.lessonsLearned)}
      />
      <ReviewTextField
        label={j.mistakes}
        value={mistakes}
        onChange={setMistakes}
        error={fieldError('mistakes', j.mistakes)}
      />
      <ChartImageField
        tradeId={entry.trade.id}
        savedUrl={entry.chartImageUrl}
        savedKey={entry.chartImageKey}
        imageKey={imageKey}
        onKey={setImageKey}
        alt={formatCopy(j.chartImageAlt, { symbol })}
      />
      {fieldErrors.chartImagePublicId && (
        <span role="alert" className={fieldErrorClass}>
          {fieldError('chartImagePublicId', j.chartImage)}
        </span>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDone(false)}
          disabled={save.isPending}
        >
          {j.reviewCancel}
        </Button>
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? j.reviewSaving : j.reviewSave}
        </Button>
      </div>
    </form>
  );
}
