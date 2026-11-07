import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Copy, Lock, X } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import type { AiMessage, AiQuota } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { AiBotIcon } from './AiBotIcon';
import { AnswerText } from './AnswerText';

/** SRS 3.9.1: a question is 1 to 1,000 characters. */
export const QUESTION_MAX = 1000;

/** The colour of a page: blue for the market, purple for "my trading". */
export type ChatAccent = 'primary' | 'purple';

const ACCENT: Record<
  ChatAccent,
  { solid: string; soft: string; ring: string; text: string; dot: string }
> = {
  primary: {
    solid: 'bg-primary text-white',
    soft: 'bg-primary-soft text-primary',
    ring: 'focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-soft',
    text: 'text-primary',
    dot: 'bg-primary',
  },
  purple: {
    solid: 'bg-purple text-white',
    soft: 'bg-purple-soft text-purple',
    ring: 'focus-within:border-purple focus-within:ring-4 focus-within:ring-purple-soft',
    text: 'text-purple',
    dot: 'bg-purple',
  },
};

function timeOf(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function BotAvatar({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        'inline-flex shrink-0 items-center justify-center rounded-[10px] bg-[#17212f] dark:bg-raised',
        small ? 'size-7' : 'size-8',
      )}
    >
      <AiBotIcon size={small ? 20 : 24} />
    </span>
  );
}

function Message({
  message,
  accent,
  compact,
}: {
  message: AiMessage;
  accent: ChatAccent;
  compact: boolean;
}) {
  const t = useCopy().aiAssistant;
  const { show } = useToast();
  if (message.role === 'USER')
    return (
      <li className="flex flex-col items-end gap-1">
        <span className="sr-only">{t.you}: </span>
        <p
          className={classNames(
            'm-0 max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap sm:max-w-[75%]',
            ACCENT[accent].solid,
          )}
        >
          {message.content}
        </p>
        {message.status === 'FAILED' && (
          <p role="alert" className="m-0 text-xs text-negative">
            {t.failed}
          </p>
        )}
      </li>
    );

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.content);
      show({ tone: 'success', message: t.copied });
    } catch {
      // Without clipboard access the answer can still be selected by hand.
    }
  }

  return (
    <li className="flex items-start gap-2.5">
      <BotAvatar small={compact} />
      <div className="min-w-0 max-w-[90%] sm:max-w-[80%]">
        {!compact && (
          <p className="m-0 mb-1 text-[11px] text-muted">
            <span className="font-semibold text-fg">{t.assistantName}</span>
            {' · '}
            {timeOf(message.createdAt)}
          </p>
        )}
        <div className="rounded-2xl rounded-tl-md bg-surface-alt px-3.5 py-2.5 text-fg">
          <span className="sr-only">{t.assistant}: </span>
          <AnswerText text={message.content} />
        </div>
        <button
          type="button"
          onClick={() => void copyAnswer()}
          className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted hover:bg-raised hover:text-fg-2"
        >
          <Copy size={12} aria-hidden="true" />
          {t.copy}
        </button>
      </div>
    </li>
  );
}

function Typing({ accent, compact }: { accent: ChatAccent; compact: boolean }) {
  const t = useCopy().aiAssistant;
  const dot = classNames(
    'size-1.5 animate-bounce rounded-full',
    ACCENT[accent].dot,
  );
  return (
    <li className="flex items-center gap-2.5" role="status">
      <BotAvatar small={compact} />
      <span className="inline-flex items-center gap-2.5 rounded-2xl rounded-tl-md bg-surface-alt px-3.5 py-2.5">
        <span aria-hidden="true" className="inline-flex gap-1">
          <span className={dot} />
          <span className={dot} style={{ animationDelay: '150ms' }} />
          <span className={dot} style={{ animationDelay: '300ms' }} />
        </span>
        <span className="text-xs text-muted">{t.thinking}</span>
      </span>
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

/** Today's questions left, as a small badge for a page header. */
export function QuotaBadge({ quota }: { quota: AiQuota | undefined }) {
  const t = useCopy().aiAssistant;
  if (!quota || quota.limit === 0) return null;
  return (
    <span
      title={quotaLine(t, quota)}
      className={classNames(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px]',
        quota.canAsk
          ? 'bg-surface-alt text-fg-2'
          : 'bg-negative-soft text-negative',
      )}
    >
      {quota.limit === null ? (
        t.quotaUnlimited
      ) : (
        <>
          <span className="font-mono font-semibold">
            {(quota.remaining ?? 0) + '/' + quota.limit}
          </span>
          {t.quotaShort}
        </>
      )}
    </span>
  );
}

/** One thing that goes with the next question, shown above the box. */
export interface AskAttachment {
  key: string;
  label: string;
  /** Absent when the chosen kind of question cannot go without it. */
  onRemove?: () => void;
}

/** An example question of the empty chat; picking it fills the box. */
export interface AskSuggestion {
  key: string;
  text: string;
  /** A line under the question (the page's cards). */
  hint?: string;
  /** A small icon or tag before the question. */
  icon?: ReactNode;
  onPick?: () => void;
}

/** What an empty chat greets the Trader with. */
export interface ChatWelcome {
  title: string;
  body: string;
}

function Welcome({
  welcome,
  suggestions,
  accent,
  compact,
  onPick,
}: {
  welcome: ChatWelcome;
  suggestions: readonly AskSuggestion[];
  accent: ChatAccent;
  compact: boolean;
  onPick: (suggestion: AskSuggestion) => void;
}) {
  const t = useCopy().aiAssistant;
  if (compact)
    return (
      <div className="grid gap-3 py-1">
        <div>
          <p className="m-0 text-base font-semibold text-fg">{welcome.title}</p>
          <p className="m-0 mt-1 text-xs leading-relaxed text-muted">
            {welcome.body}
          </p>
        </div>
        <p className="m-0 text-[10.5px] font-semibold tracking-wider text-muted-dim uppercase">
          {t.suggestionsTitle}
        </p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {suggestions.map((suggestion) => (
            <li key={suggestion.key}>
              <button
                type="button"
                onClick={() => onPick(suggestion)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-[13px] font-medium text-fg hover:border-line-strong hover:bg-raised"
              >
                {suggestion.icon}
                <span className="flex-1">{suggestion.text}</span>
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className="text-muted-x"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="grid justify-items-center gap-6 px-2 py-10 text-center">
      <div className="grid justify-items-center gap-2.5">
        <span
          aria-hidden="true"
          className={classNames(
            'inline-flex size-14 items-center justify-center rounded-2xl shadow-lg',
            ACCENT[accent].solid,
          )}
        >
          <AiBotIcon size={38} />
        </span>
        <p className="m-0 text-xl font-semibold tracking-tight text-fg">
          {welcome.title}
        </p>
        <p className="m-0 max-w-md text-[13px] leading-relaxed text-muted">
          {welcome.body}
        </p>
      </div>
      <ul className="m-0 grid w-full max-w-2xl list-none gap-3 p-0 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.key}>
            <button
              type="button"
              onClick={() => onPick(suggestion)}
              className="flex h-full w-full items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left hover:border-line-strong hover:bg-raised"
            >
              {suggestion.icon}
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-fg">
                  {suggestion.text}
                </span>
                {suggestion.hint && (
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {suggestion.hint}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Attachments({
  attachments,
  emptyText,
  accent,
}: {
  attachments: readonly AskAttachment[];
  emptyText: string;
  accent: ChatAccent;
}) {
  const t = useCopy().aiAssistant;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-muted">{t.sees}</span>
      {attachments.length === 0 ? (
        <span className="text-muted-dim">{emptyText}</span>
      ) : (
        attachments.map((attachment) => (
          <span
            key={attachment.key}
            className={classNames(
              'inline-flex h-6 items-center gap-1 rounded-full font-semibold',
              attachment.onRemove
                ? classNames('pr-1 pl-2.5', ACCENT[accent].soft)
                : 'bg-surface-alt px-2.5 font-medium text-fg-2',
            )}
          >
            {attachment.label}
            {attachment.onRemove && (
              <button
                type="button"
                aria-label={formatCopy(t.remove, { item: attachment.label })}
                onClick={attachment.onRemove}
                className="inline-flex size-4 items-center justify-center rounded-full hover:bg-surface"
              >
                <X size={11} aria-hidden="true" />
              </button>
            )}
          </span>
        ))
      )}
    </div>
  );
}

/**
 * The chat of SCR-29 and of the floating chat: the conversation oldest
 * first, a typing line while a question is pending (MSG31 when it failed),
 * and the question box (Enter sends, Shift+Enter breaks the line; MSG30
 * when the quota is used up). Without the assistant in the plan (BR-52) the
 * conversation stays readable and the box gives way to the upgrade prompt.
 * The box is open before any conversation exists: the first question starts
 * one. Above the box: what the assistant will read with the question; in an
 * empty chat: a greeting and example questions. `compact` is the floating
 * chat's form; `framed` draws the chat's own card.
 */
export function ChatPanel({
  messages,
  loading,
  quota,
  asking,
  placeholder,
  attachments,
  emptyAttachmentText,
  canSend = true,
  compact = false,
  framed = false,
  accent = 'primary',
  welcome,
  suggestions,
  footer,
  onAsk,
}: {
  messages: readonly AiMessage[];
  loading: boolean;
  quota: AiQuota | undefined;
  asking: boolean;
  placeholder: string;
  attachments: readonly AskAttachment[];
  /** What the line above the box says when nothing goes with the question. */
  emptyAttachmentText?: string;
  /** False while the chosen kind of question still lacks what it sends. */
  canSend?: boolean;
  compact?: boolean;
  framed?: boolean;
  accent?: ChatAccent;
  welcome: ChatWelcome;
  suggestions: readonly AskSuggestion[];
  /** A line under the box (privacy, a link). */
  footer?: ReactNode;
  onAsk: (question: string) => Promise<boolean>;
}) {
  const t = useCopy().aiAssistant;
  const boxId = useId();
  const [draft, setDraft] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const ordered = [...messages].reverse();
  const pending = messages.some((message) => message.status === 'PENDING');
  const onPlan = quota !== undefined && quota.limit !== 0;
  const canAsk = quota?.canAsk ?? false;
  const tone = ACCENT[accent];

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, pending]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!canSend || question === '' || question.length > QUESTION_MAX) return;
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
    body = (
      <Welcome
        welcome={welcome}
        suggestions={canAsk ? suggestions : []}
        accent={accent}
        compact={compact}
        onPick={(suggestion) => {
          suggestion.onPick?.();
          setDraft(suggestion.text);
        }}
      />
    );
  else
    body = (
      <ol
        className={classNames(
          'm-0 grid list-none p-0',
          compact ? 'gap-3' : 'gap-5',
        )}
        aria-live="polite"
      >
        {ordered
          .filter(
            (message) =>
              message.status !== 'PENDING' || message.role === 'USER',
          )
          .map((message) => (
            <Message
              key={message.id}
              message={message}
              accent={accent}
              compact={compact}
            />
          ))}
        {pending && <Typing accent={accent} compact={compact} />}
      </ol>
    );

  const sendDisabled =
    !canAsk || !canSend || asking || pending || draft.trim() === '';

  return (
    <section
      aria-label={t.title}
      className={classNames(
        'flex min-h-0 min-w-0 flex-1 flex-col',
        framed && 'rounded-2xl border border-line bg-surface',
      )}
    >
      <div
        className={classNames(
          'min-h-0 flex-1 overflow-y-auto',
          compact ? 'px-3 py-4' : 'px-4 py-5 sm:px-5',
        )}
      >
        {body}
        <div ref={end} />
      </div>
      <div
        className={classNames(
          'border-t border-line',
          compact ? 'px-3 pt-2.5 pb-3' : 'px-4 pt-3 pb-4 sm:px-5',
        )}
      >
        {quota && !onPlan ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-soft p-3">
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
            {!compact && (
              <Attachments
                attachments={attachments}
                emptyText={emptyAttachmentText ?? t.seesNothing}
                accent={accent}
              />
            )}
            <div
              className={classNames(
                'flex items-end gap-2 rounded-2xl border-[1.5px] border-line-strong bg-surface py-1.5 pr-1.5 pl-3.5 transition-shadow',
                tone.ring,
                !canAsk && 'opacity-60',
              )}
            >
              <label htmlFor={boxId} className="sr-only">
                {placeholder}
              </label>
              <textarea
                id={boxId}
                rows={compact ? 1 : 2}
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
                className="max-h-40 min-h-[36px] flex-1 resize-none border-0 bg-transparent py-2 text-sm text-fg outline-none placeholder:text-muted-x"
              />
              <button
                type="submit"
                aria-label={t.send}
                title={t.send}
                disabled={sendDisabled}
                className={classNames(
                  'inline-flex shrink-0 items-center justify-center rounded-xl transition-opacity disabled:cursor-not-allowed disabled:opacity-40',
                  compact ? 'size-9' : 'size-10',
                  tone.solid,
                )}
              >
                <ArrowRight size={compact ? 16 : 18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-[11px]">
              <span
                className={classNames(
                  quota && !canAsk ? 'text-negative' : 'text-muted-dim',
                )}
              >
                {quota && !canAsk
                  ? quotaLine(t, quota)
                  : compact
                    ? t.disclaimerShort
                    : t.sendHint}
              </span>
              <span className="font-mono text-muted-dim">
                {compact && quota && canAsk && quota.limit !== null
                  ? (quota.remaining ?? 0) + '/' + quota.limit
                  : draft.length > 0
                    ? draft.length + '/' + QUESTION_MAX
                    : ''}
              </span>
            </div>
          </form>
        )}
        {footer && (
          <div className="mt-1.5 px-1 text-[11px] text-muted-dim">{footer}</div>
        )}
      </div>
    </section>
  );
}

/** A coloured tag for a suggestion of the floating chat. */
export function SuggestionTag({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-bold',
        className,
      )}
    >
      {label}
    </span>
  );
}

/** A coloured icon tile for a suggestion card of SCR-29. */
export function SuggestionIcon({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-[9px]',
        className,
      )}
    >
      {children}
    </span>
  );
}
