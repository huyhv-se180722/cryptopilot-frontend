import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Lock, Send, Sparkles, User, X } from 'lucide-react';
import { EmptyState } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { buttonClassName } from '../../../components/ui/button-styles';
import { fieldControlClass } from '../../../components/ui/field-styles';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import type { AiMessage, AiQuota } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { AnswerText } from './AnswerText';

/** SRS 3.9.1: a question is 1 to 1,000 characters. */
export const QUESTION_MAX = 1000;

function Bubble({ message }: { message: AiMessage }) {
  const t = useCopy().aiAssistant;
  const mine = message.role === 'USER';
  return (
    <li className={classNames('flex gap-2', mine && 'flex-row-reverse')}>
      <span
        aria-hidden="true"
        className={classNames(
          'mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full',
          mine ? 'bg-primary-soft text-primary' : 'bg-raised text-fg-2',
        )}
      >
        {mine ? <User size={14} /> : <Bot size={14} />}
      </span>
      <div
        className={classNames(
          'max-w-[85%] rounded-xl px-3 py-2',
          mine
            ? 'bg-primary-soft text-fg'
            : 'border border-line bg-surface text-fg',
        )}
      >
        <span className="sr-only">{mine ? t.you : t.assistant}: </span>
        {mine ? (
          <p className="m-0 whitespace-pre-wrap break-words text-sm">
            {message.content}
          </p>
        ) : (
          <AnswerText text={message.content} />
        )}
        {mine && message.status === 'FAILED' && (
          <p role="alert" className="m-0 mt-1 text-xs text-negative">
            {t.failed}
          </p>
        )}
      </div>
    </li>
  );
}

function quotaLine(
  t: ReturnType<typeof useCopy>['aiAssistant'],
  quota: AiQuota,
) {
  if (quota.limit === null) return t.quotaUnlimited;
  if (!quota.canAsk)
    return formatCopy(t.quotaExhausted, { quota: quota.limit });
  return formatCopy(t.quota, {
    remaining: quota.remaining ?? 0,
    limit: quota.limit,
  });
}

/** One thing that goes with the next question, shown above the box. */
export interface AskAttachment {
  key: string;
  label: string;
  onRemove: () => void;
}

/** An example question of the empty chat; picking it fills the box. */
export interface AskSuggestion {
  key: string;
  text: string;
  onPick?: () => void;
}

function Suggestions({
  suggestions,
  onPick,
}: {
  suggestions: readonly AskSuggestion[];
  onPick: (suggestion: AskSuggestion) => void;
}) {
  const t = useCopy().aiAssistant;
  return (
    <div className="grid justify-items-center gap-3 py-8 text-center">
      <Bot size={28} aria-hidden="true" className="text-muted-dim" />
      <p className="m-0 text-sm font-medium text-fg">{t.emptyChat}</p>
      <div className="grid justify-items-center gap-2">
        <p className="m-0 text-xs text-muted">{t.suggestionsTitle}</p>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
          {suggestions.map((suggestion) => (
            <li key={suggestion.key}>
              <button
                type="button"
                onClick={() => onPick(suggestion)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-fg-2 hover:border-primary hover:text-fg"
              >
                <Sparkles size={12} aria-hidden="true" />
                {suggestion.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Attachments({
  attachments,
}: {
  attachments: readonly AskAttachment[];
}) {
  const t = useCopy().aiAssistant;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-muted">{t.sees}</span>
      {attachments.length === 0 ? (
        <span className="text-muted-dim">{t.seesNothing}</span>
      ) : (
        attachments.map((attachment) => (
          <span
            key={attachment.key}
            className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pr-1 pl-2 font-medium text-fg"
          >
            {attachment.label}
            <button
              type="button"
              aria-label={formatCopy(t.remove, { item: attachment.label })}
              onClick={attachment.onRemove}
              className="inline-flex size-4 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-fg"
            >
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        ))
      )}
    </div>
  );
}

/**
 * The chat panel of SCR-29: the conversation oldest first, a typing line
 * while a question is pending (MSG31 when it failed), and the question box
 * with today's quota (MSG30 when used up). Without the assistant in the
 * plan (BR-52) the conversation stays readable and the box gives way to the
 * upgrade prompt. The box is open before any conversation exists: the
 * first question starts one. Above the box: what the assistant will read
 * with the question; in an empty chat: example questions.
 */
export function ChatPanel({
  messages,
  loading,
  quota,
  asking,
  placeholder,
  attachments,
  suggestions,
  onAsk,
}: {
  messages: readonly AiMessage[];
  loading: boolean;
  quota: AiQuota | undefined;
  asking: boolean;
  placeholder: string;
  attachments: readonly AskAttachment[];
  suggestions: readonly AskSuggestion[];
  onAsk: (question: string) => Promise<boolean>;
}) {
  const t = useCopy().aiAssistant;
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const ordered = [...messages].reverse();
  const pending = messages.some((message) => message.status === 'PENDING');
  const onPlan = quota !== undefined && quota.limit !== 0;
  const canAsk = quota?.canAsk ?? false;

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, pending]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (question === '' || question.length > QUESTION_MAX) return;
    if (await onAsk(question)) setDraft('');
  }

  let body;
  if (loading)
    body = (
      <div className="grid gap-3 p-2">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
      </div>
    );
  else if (ordered.length === 0)
    body = canAsk ? (
      <Suggestions
        suggestions={suggestions}
        onPick={(suggestion) => {
          suggestion.onPick?.();
          setDraft(suggestion.text);
        }}
      />
    ) : (
      <EmptyState icon={Bot} title={t.emptyChat} />
    );
  else
    body = (
      <ol className="m-0 grid list-none gap-3 p-0" aria-live="polite">
        {ordered
          .filter(
            (message) =>
              message.status !== 'PENDING' || message.role === 'USER',
          )
          .map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
        {pending && (
          <li
            className="flex items-center gap-2 text-xs text-muted"
            role="status"
          >
            <Bot size={14} aria-hidden="true" />
            <span className="animate-pulse">{t.thinking}</span>
          </li>
        )}
      </ol>
    );

  return (
    <section
      aria-label={t.title}
      className="flex min-h-[420px] min-w-0 flex-col rounded-lg border border-line bg-surface"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {body}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        {quota && !onPlan ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-soft p-3">
            <div className="flex items-start gap-2">
              <Lock
                size={16}
                aria-hidden="true"
                className="mt-0.5 text-warning"
              />
              <div>
                <p className="m-0 text-sm font-medium text-fg">
                  {t.upgradeTitle}
                </p>
                <p className="m-0 text-xs text-fg-2">{t.upgradeBody}</p>
              </div>
            </div>
            <Link
              to="/subscription"
              className={buttonClassName('primary', 'sm', 'no-underline')}
            >
              {t.upgradeAction}
            </Link>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="grid gap-2">
            <Attachments attachments={attachments} />
            <label htmlFor="ai-question" className="sr-only">
              {placeholder}
            </label>
            <textarea
              id="ai-question"
              rows={3}
              maxLength={QUESTION_MAX}
              value={draft}
              placeholder={placeholder}
              disabled={!canAsk}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              className={classNames(fieldControlClass, 'resize-none')}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={classNames(
                  'text-[11px]',
                  quota && !canAsk ? 'text-negative' : 'text-muted-dim',
                )}
              >
                {quota ? quotaLine(t, quota) : ''}
                <span className="ml-2">
                  {draft.length}/{QUESTION_MAX}
                </span>
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!canAsk || asking || pending || draft.trim() === ''}
              >
                <Send size={14} aria-hidden="true" />
                {t.send}
              </Button>
            </div>
          </form>
        )}
        <p className="m-0 mt-2 text-[11px] text-muted-dim">{t.disclaimer}</p>
      </div>
    </section>
  );
}
