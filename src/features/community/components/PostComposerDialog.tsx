import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ImagePlus,
  Loader2,
  Maximize2,
  Smile,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useAuth } from '../../../hooks/use-auth';
import { useCopy } from '../../../hooks/use-copy';
import { useToast } from '../../../hooks/use-toast';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { PostMediaRef, PostSentiment } from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { toFixedDecimal } from '../../../utils/decimal-format';
import { useMediaUpload, useSavePost } from '../hooks/use-community';
import { useCoinPrices } from './coin-prices';
import { cashtagsOf, handleOf } from './post-format';
import { AuthorAvatar } from './PostParts';

const TITLE = { min: 5, max: 150 };
const CONTENT_MAX = 10_000;
const COINS_MAX = 5;
const IMAGES_MAX = 4;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const SUGGESTIONS_MAX = 8;
/** The cashtag being typed right before the caret: `$` and 0-10 letters. */
const TYPING_TAG = /(^|[^A-Za-z0-9$])\$([A-Za-z0-9]{0,10})$/;
const EMOJIS = ['🚀', '📈', '📉', '🔥', '💎', '🐂', '🐻', '👀', '🤔', '✅'];

interface Upload {
  key: string;
  preview: string;
  progress: number;
  ref: PostMediaRef | null;
  error: string | null;
  controller: AbortController;
}

/**
 * The Post dialog of CoinMarketCap Community (SCR-26 in short, D-99): the
 * title the author writes, the text, Bullish or Bearish, up to four
 * images and emoji. Coins are the `$` cashtags of the text. A video, a
 * market or more room is in the full editor.
 */
export function PostComposerDialog({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  /** After the post is published, e.g. to show it on top of Latest. */
  onPublished?: () => void;
}) {
  const copy = useCopy();
  const c = copy.community;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      className="m-auto w-[calc(100vw-32px)] max-w-2xl rounded-2xl border border-line-strong bg-surface p-6 text-fg shadow-overlay backdrop:bg-(--cp-backdrop) backdrop:backdrop-blur-sm sm:p-8"
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 id={titleId} className="text-xl font-bold text-fg">
          {c.composerTitle}
        </h2>
        <button
          type="button"
          aria-label={copy.common.close}
          onClick={onClose}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-x hover:bg-raised hover:text-fg-2"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <Composer
          onDone={() => {
            onClose();
            onPublished?.();
          }}
        />
      )}
    </dialog>
  );
}

function Composer({ onDone }: { onDone: () => void }) {
  const copy = useCopy();
  const c = copy.community;
  const f = c.form;
  const { show } = useToast();
  const user = useAuth().session?.user;
  const { quotes } = useCoinPrices();
  const save = useSavePost();
  const upload = useMediaUpload();
  const files = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [picked, setPicked] = useState(0);
  const [pickerClosed, setPickerClosed] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sentiment, setSentiment] = useState<PostSentiment | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [emoji, setEmoji] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URLs are released when the dialog closes.
  const live = useRef(uploads);
  useEffect(() => {
    live.current = uploads;
  }, [uploads]);
  useEffect(
    () => () => {
      for (const item of live.current) {
        item.controller.abort();
        URL.revokeObjectURL(item.preview);
      }
    },
    [],
  );

  const tagged = cashtagsOf(content);
  const coins =
    quotes.size === 0 ? tagged : tagged.filter((coin) => quotes.has(coin));
  const uploading = uploads.some((u) => !u.ref && !u.error);

  // The coins offered while a `$` tag is typed: listed Spot coins whose
  // symbol or name starts with what follows the `$`.
  const typing = TYPING_TAG.exec(content.slice(0, caret));
  const query = typing ? (typing[2] ?? '').toUpperCase() : null;
  const suggestions =
    query === null || pickerClosed
      ? []
      : [...quotes.values()]
          .filter(
            (q) =>
              q.coin.startsWith(query) ||
              (q.pair.baseAssetName ?? '').toUpperCase().startsWith(query),
          )
          .slice(0, SUGGESTIONS_MAX);
  const active = Math.min(picked, Math.max(0, suggestions.length - 1));

  function track() {
    const area = text.current;
    if (area) setCaret(area.selectionStart);
  }

  function choose(coin: string) {
    const area = text.current;
    if (!typing || !area) return;
    const start = caret - (typing[2] ?? '').length - 1;
    const next =
      content.slice(0, start) + '$' + coin + ' ' + content.slice(caret);
    const at = start + coin.length + 2;
    setContent(next);
    setCaret(at);
    setPicked(0);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(at, at);
    });
  }

  function onTextKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setPicked((active + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      const coin = suggestions[active]?.coin;
      if (coin) {
        event.preventDefault();
        choose(coin);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setPickerClosed(true);
    }
  }
  const name = user?.displayName ?? c.noName;

  function patch(key: string, change: Partial<Upload>) {
    setUploads((items) =>
      items.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = IMAGES_MAX - uploads.length;
    if (list.length > room) setError(f.tooManyImages);
    for (const file of [...list].slice(0, Math.max(0, room))) {
      const key = crypto.randomUUID();
      const controller = new AbortController();
      const preview = URL.createObjectURL(file);
      setUploads((items) => [
        ...items,
        { key, preview, progress: 0, ref: null, error: null, controller },
      ]);
      upload(
        file,
        'IMAGE',
        (share) => patch(key, { progress: share }),
        controller.signal,
      ).then(
        (done) => patch(key, { ref: done }),
        (failure: unknown) => {
          if (!controller.signal.aborted)
            patch(key, { error: errorText(copy, failure) });
        },
      );
    }
  }

  function remove(key: string) {
    setUploads((items) => {
      const item = items.find((u) => u.key === key);
      item?.controller.abort();
      if (item) URL.revokeObjectURL(item.preview);
      return items.filter((u) => u.key !== key);
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (cleanTitle.length < TITLE.min || cleanTitle.length > TITLE.max)
      return setError(f.titleLength);
    if (cleanContent.length < 1) return setError(f.contentLength);
    if (coins.length > COINS_MAX) return setError(c.composerTooManyCoins);
    if (uploading) return setError(f.waitUploads);
    setError(null);
    const result = await save.run({
      title: cleanTitle,
      content: cleanContent,
      market: null,
      coins,
      media: uploads.flatMap((u) => (u.ref ? [u.ref] : [])),
      sentiment,
    });
    if (result.status === 'success') {
      show({ tone: 'success', message: c.composerPublished });
      onDone();
    } else if (result.status === 'error') {
      const fields = problemOf(result.error)?.fieldErrors ?? {};
      setError(
        fields.title
          ? f.titleLength
          : fields.content
            ? f.contentLength
            : fields.coins
              ? f.coinsInvalid
              : errorText(copy, result.error),
      );
    }
  }

  const stance = (value: PostSentiment) =>
    setSentiment((current) => (current === value ? null : value));

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <div className="flex items-start gap-3">
        <AuthorAvatar
          author={{ displayName: user?.displayName ?? null, avatarUrl: null }}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="mt-2 text-base">
            <span className="font-semibold text-fg">{name}</span>{' '}
            <span className="text-muted-x">
              {handleOf(user?.displayName ?? null)}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor={listId + '-title'}
            className="text-xs font-semibold text-fg-2"
          >
            {f.title}
          </label>
          <span className="font-mono text-[11px] text-muted-x">
            {title.trim().length}/{TITLE.max}
          </span>
        </div>
        <input
          id={listId + '-title'}
          placeholder={c.composerTitlePlaceholder}
          value={title}
          maxLength={TITLE.max}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-raised px-4 text-sm font-semibold text-fg placeholder:font-normal placeholder:text-muted-x focus:border-primary-line focus:outline-none"
        />
      </div>
      <div className="relative mt-3">
        <label
          htmlFor={listId + '-content'}
          className="mb-1.5 block text-xs font-semibold text-fg-2"
        >
          {f.content}
        </label>
        <textarea
          id={listId + '-content'}
          ref={text}
          placeholder={c.composerPlaceholder}
          value={content}
          maxLength={CONTENT_MAX}
          rows={5}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId + '-coins'}
          {...(suggestions.length > 0
            ? {
                'aria-activedescendant':
                  listId + '-coin-' + (suggestions[active]?.coin ?? ''),
              }
            : {})}
          onChange={(e) => {
            setContent(e.target.value);
            setCaret(e.target.selectionStart);
            setPickerClosed(false);
            setPicked(0);
          }}
          onKeyDown={onTextKey}
          onKeyUp={track}
          onClick={track}
          onBlur={() => setPickerClosed(true)}
          onFocus={() => setPickerClosed(false)}
          className="block min-h-32 w-full resize-y rounded-xl border border-line bg-raised px-4 py-3 text-sm leading-relaxed text-fg placeholder:text-muted-x focus:border-primary-line focus:outline-none"
        />
        {suggestions.length > 0 && (
          <ul
            id={listId + '-coins'}
            role="listbox"
            aria-label={c.composerCoinPicker}
            className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-line-strong bg-surface py-1 shadow-(--cp-shadow-panel)"
          >
            {suggestions.map((q, index) => {
              const change = q.ticker?.changePercent24h ?? null;
              const up = change !== null && !change.startsWith('-');
              return (
                <li
                  key={q.coin}
                  id={listId + '-coin-' + q.coin}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(e) => {
                    // Keeps the focus in the text, so the list stays open.
                    e.preventDefault();
                    choose(q.coin);
                  }}
                  onMouseEnter={() => setPicked(index)}
                  className={classNames(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs',
                    index === active ? 'bg-primary-soft' : 'hover:bg-raised',
                  )}
                >
                  {q.pair.logoUrl ? (
                    <img
                      src={q.pair.logoUrl}
                      alt=""
                      className="size-5 rounded-full"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-5 items-center justify-center rounded-full bg-raised text-[8px] font-bold text-fg-2"
                    >
                      {q.coin.slice(0, 3)}
                    </span>
                  )}
                  <span className="font-semibold text-fg">${q.coin}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-x">
                    {q.pair.baseAssetName ?? ''}
                  </span>
                  {change !== null && (
                    <span
                      className={classNames(
                        'font-mono text-[11px]',
                        up ? 'text-positive' : 'text-negative',
                      )}
                    >
                      {up ? '+' : '-'}
                      {toFixedDecimal(change.replace(/^-/, ''), 2)}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {uploads.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {uploads.map((item) => (
            <li
              key={item.key}
              className="relative overflow-hidden rounded-lg border border-line"
            >
              <img
                src={item.preview}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {!item.ref && !item.error && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] text-white">
                  <Loader2
                    size={14}
                    aria-hidden="true"
                    className="mr-1 animate-spin"
                  />
                  {Math.round(item.progress * 100)}%
                </span>
              )}
              {item.error && (
                <span className="absolute inset-x-0 bottom-0 bg-negative/90 px-1 py-0.5 text-[10px] text-white">
                  {item.error}
                </span>
              )}
              <button
                type="button"
                aria-label={formatCopy(f.removeMedia, { name: '' })}
                onClick={() => remove(item.key)}
                className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 min-h-4 text-[11px] text-muted-dim">
        {coins.length > 0
          ? formatCopy(c.composerCoins, {
              coins: coins.map((coin) => '$' + coin).join(' '),
            })
          : c.composerCashtagHint}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-negative">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={c.composerStance}
          className="flex overflow-hidden rounded-lg border border-line"
        >
          <button
            type="button"
            aria-pressed={sentiment === 'BULLISH'}
            onClick={() => stance('BULLISH')}
            className={classNames(
              'inline-flex h-10 items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors duration-150',
              sentiment === 'BULLISH'
                ? 'bg-positive-soft text-positive'
                : 'text-fg-2 hover:bg-raised',
            )}
          >
            <TrendingUp
              size={15}
              aria-hidden="true"
              className="text-positive"
            />
            {c.bullish}
          </button>
          <button
            type="button"
            aria-pressed={sentiment === 'BEARISH'}
            onClick={() => stance('BEARISH')}
            className={classNames(
              'inline-flex h-10 items-center gap-1.5 border-l border-line px-3.5 text-xs font-semibold transition-colors duration-150',
              sentiment === 'BEARISH'
                ? 'bg-negative-soft text-negative'
                : 'text-fg-2 hover:bg-raised',
            )}
          >
            <TrendingDown
              size={15}
              aria-hidden="true"
              className="text-negative"
            />
            {c.bearish}
          </button>
        </div>
        <input
          ref={files}
          type="file"
          accept={IMAGE_TYPES}
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          aria-label={c.composerImage}
          title={c.composerImage}
          disabled={uploads.length >= IMAGES_MAX}
          onClick={() => files.current?.click()}
          className="inline-flex size-9 items-center justify-center rounded-lg text-fg-2 hover:bg-raised disabled:opacity-40"
        >
          <ImagePlus size={19} aria-hidden="true" />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label={c.composerEmoji}
            title={c.composerEmoji}
            aria-expanded={emoji}
            onClick={() => setEmoji((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-fg-2 hover:bg-raised"
          >
            <Smile size={19} aria-hidden="true" />
          </button>
          {emoji && (
            <div className="absolute bottom-full left-0 z-10 mb-1 grid w-44 grid-cols-5 gap-1 rounded-xl border border-line-strong bg-surface p-2 shadow-(--cp-shadow-panel)">
              {EMOJIS.map((each) => (
                <button
                  key={each}
                  type="button"
                  onClick={() => {
                    setContent((text) => text + each);
                    setEmoji(false);
                  }}
                  className="rounded-md p-1 text-lg hover:bg-raised"
                >
                  {each}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link
          to="/community/new"
          title={c.composerFullEditor}
          aria-label={c.composerFullEditor}
          className="inline-flex size-9 items-center justify-center rounded-lg text-fg-2 hover:bg-raised"
        >
          <Maximize2 size={17} aria-hidden="true" />
        </Link>
        <button
          type="submit"
          disabled={save.pending}
          className="ml-auto inline-flex h-11 min-w-24 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white hover:enabled:opacity-90 disabled:opacity-50"
        >
          {c.composerPost}
        </button>
      </div>
    </form>
  );
}
