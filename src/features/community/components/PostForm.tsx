import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Loader2, Lock, Video, X } from 'lucide-react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type {
  MarketType,
  PostDetail,
  PostDraft,
  PostMediaKind,
  PostMediaRef,
} from '../../../types/domain';
import { classNames } from '../../../utils/class-names';
import { useMediaUpload } from '../hooks/use-community';

const TITLE = { min: 5, max: 150 };
const CONTENT_MAX = 10_000;
const COINS_MAX = 5;
const IMAGES_MAX = 4;
const COIN = /^[A-Z0-9]{1,20}$/;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const VIDEO_TYPES = 'video/mp4,video/webm';

interface MediaItem {
  key: string;
  name: string;
  kind: PostMediaKind;
  preview: string | null;
  status: 'uploading' | 'ready' | 'error';
  progress: number;
  ref: PostMediaRef | null;
  error: string | null;
  /** Object URL to release when the item goes. */
  owned: boolean;
  controller: AbortController | null;
}

type Field = 'title' | 'content' | 'coins' | 'media';
type FieldErrors = Partial<Record<Field, string | undefined>>;

/**
 * SCR-26 Create / edit post (SRS 3.7.2, UC-27, UC-29): title 5–150,
 * content 1–10,000, up to 5 coin tags, an optional market, and up to 4
 * images or 1 video (BR-44) uploaded one by one before publishing. Video
 * needs `VIDEO_POST` (BR-43); the server's answer (MSG29, MSG32) wins.
 */
export function PostForm({
  post,
  videoAllowed,
  coinSuggestions,
  onSubmit,
  onCancel,
}: {
  /** The post being edited, or undefined for a new one. */
  post?: PostDetail;
  videoAllowed: boolean;
  coinSuggestions: readonly string[];
  /** Resolves with the refusal, if any. */
  onSubmit: (draft: PostDraft) => Promise<unknown>;
  onCancel: () => void;
}) {
  const copy = useCopy();
  const c = copy.community;
  const f = c.form;
  const upload = useMediaUpload();
  const listId = useId();
  const [title, setTitle] = useState(post?.title ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [market, setMarket] = useState<MarketType | ''>(post?.market ?? '');
  const [coins, setCoins] = useState<string[]>([...(post?.coins ?? [])]);
  const [coinText, setCoinText] = useState('');
  const [media, setMedia] = useState<MediaItem[]>(
    () =>
      post?.media.map((m) => ({
        key: m.publicId,
        name: m.publicId.split('/').pop() ?? m.publicId,
        kind: m.kind,
        preview: m.kind === 'VIDEO' ? m.thumbnailUrl : m.url,
        status: 'ready',
        progress: 1,
        ref: { publicId: m.publicId, kind: m.kind },
        error: null,
        owned: false,
        controller: null,
      })) ?? [],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  // Uploads in flight stop and previews are released with the form.
  useEffect(
    () => () => {
      for (const item of mediaRef.current) {
        item.controller?.abort();
        if (item.owned && item.preview) URL.revokeObjectURL(item.preview);
      }
    },
    [],
  );

  const hasVideo = media.some((m) => m.kind === 'VIDEO');
  const images = media.filter((m) => m.kind === 'IMAGE').length;
  const uploading = media.some((m) => m.status === 'uploading');
  const failed = media.some((m) => m.status === 'error');

  function patch(key: string, change: Partial<MediaItem>) {
    setMedia((items) =>
      items.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }

  function start(file: File, kind: PostMediaKind) {
    const key = crypto.randomUUID();
    const controller = new AbortController();
    const preview = kind === 'IMAGE' ? URL.createObjectURL(file) : null;
    setMedia((items) => [
      ...items,
      {
        key,
        name: file.name,
        kind,
        preview,
        status: 'uploading',
        progress: 0,
        ref: null,
        error: null,
        owned: preview !== null,
        controller,
      },
    ]);
    upload(
      file,
      kind,
      (share) => patch(key, { progress: share }),
      controller.signal,
    ).then(
      (ref) => patch(key, { status: 'ready', ref, controller: null }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        patch(key, {
          status: 'error',
          error: errorText(copy, error),
          controller: null,
        });
      },
    );
  }

  function addFiles(files: FileList | null, kind: PostMediaKind) {
    if (!files || files.length === 0) return;
    setErrors((e) => ({ ...e, media: undefined }));
    if (kind === 'VIDEO') {
      if (media.length > 0) {
        setErrors((e) => ({ ...e, media: f.mixNotAllowed }));
        return;
      }
      const file = files[0];
      if (file) start(file, 'VIDEO');
      return;
    }
    if (hasVideo) {
      setErrors((e) => ({ ...e, media: f.mixNotAllowed }));
      return;
    }
    const room = IMAGES_MAX - images;
    const picked = [...files];
    if (picked.length > room)
      setErrors((e) => ({ ...e, media: f.tooManyImages }));
    for (const file of picked.slice(0, Math.max(0, room))) start(file, 'IMAGE');
  }

  function removeMedia(key: string) {
    setMedia((items) => {
      const item = items.find((m) => m.key === key);
      item?.controller?.abort();
      if (item?.owned && item.preview) URL.revokeObjectURL(item.preview);
      return items.filter((m) => m.key !== key);
    });
    setErrors((e) => ({ ...e, media: undefined }));
  }

  function addCoin(raw: string) {
    const symbol = raw.trim().replace(/^\$/, '').toUpperCase();
    setCoinText('');
    if (!symbol || coins.includes(symbol)) return;
    if (coins.length >= COINS_MAX) {
      setErrors((e) => ({ ...e, coins: f.coinsFull }));
      return;
    }
    if (!COIN.test(symbol)) {
      setErrors((e) => ({ ...e, coins: f.coinsInvalid }));
      return;
    }
    setErrors((e) => ({ ...e, coins: undefined }));
    setCoins((list) => [...list, symbol]);
  }

  function onCoinKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addCoin(coinText);
    } else if (event.key === 'Backspace' && coinText === '' && coins.length) {
      setCoins((list) => list.slice(0, -1));
    }
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    const t = title.trim().length;
    if (t < TITLE.min || t > TITLE.max) found.title = f.titleLength;
    const n = content.trim().length;
    if (n < 1 || n > CONTENT_MAX) found.content = f.contentLength;
    if (coins.length > COINS_MAX) found.coins = f.coinsFull;
    if (uploading || failed) found.media = f.waitUploads;
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    const pendingCoin = coinText.trim();
    const allCoins =
      pendingCoin && !coins.includes(pendingCoin.toUpperCase())
        ? [...coins, pendingCoin.replace(/^\$/, '').toUpperCase()]
        : coins;
    if (pendingCoin) {
      setCoins(allCoins);
      setCoinText('');
    }
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    const refusal = await onSubmit({
      title: title.trim(),
      content: content.trim(),
      market: market === '' ? null : market,
      coins: allCoins,
      media: media.flatMap((m) => (m.ref ? [m.ref] : [])),
    });
    setPending(false);
    if (!refusal) return;
    const problem = problemOf(refusal);
    const fields = problem?.fieldErrors ?? {};
    const server: FieldErrors = {};
    if (fields.title) server.title = f.titleLength;
    if (fields.content) server.content = f.contentLength;
    if (fields.coins) server.coins = f.coinsInvalid;
    if (
      problem?.code === 'MEDIA_INVALID' ||
      problem?.messageCode === 'MSG29' ||
      Object.keys(fields).some((k) => k.startsWith('media'))
    )
      server.media = errorText(copy, refusal);
    setErrors(server);
    if (Object.keys(server).length === 0) setNotice(errorText(copy, refusal));
  }

  const counter = (n: number, max: number) => (
    <span
      className={classNames(
        'font-mono',
        n > max ? 'text-negative' : 'text-muted-x',
      )}
    >
      {n}/{max}
    </span>
  );

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-5">
      {notice && <Banner tone="danger" title={notice} />}
      <div>
        <Input
          label={f.title}
          value={title}
          maxLength={TITLE.max + 50}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={listId + '-title-note'}
        />
        <div
          id={listId + '-title-note'}
          className="mt-1 flex justify-between gap-2 text-[11px]"
        >
          {errors.title ? (
            <span className={classNames(fieldErrorClass, 'mt-0')}>
              {errors.title}
            </span>
          ) : (
            <span className={classNames(fieldHintClass, 'mt-0')}>
              {f.titleHint}
            </span>
          )}
          {counter(title.trim().length, TITLE.max)}
        </div>
      </div>

      <div>
        <label htmlFor={listId + '-content'} className={fieldLabelClass}>
          {f.content}
        </label>
        <textarea
          id={listId + '-content'}
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-invalid={errors.content ? true : undefined}
          aria-describedby={listId + '-content-note'}
          className={classNames(fieldControlClass, 'min-h-40 resize-y')}
        />
        <div
          id={listId + '-content-note'}
          className="mt-1 flex justify-between gap-2 text-[11px]"
        >
          {errors.content ? (
            <span className={classNames(fieldErrorClass, 'mt-0')}>
              {errors.content}
            </span>
          ) : (
            <span className={classNames(fieldHintClass, 'mt-0')}>
              {f.contentHint}
            </span>
          )}
          {counter(content.trim().length, CONTENT_MAX)}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <div>
          <label htmlFor={listId + '-coin'} className={fieldLabelClass}>
            {f.coins}
          </label>
          <div
            className={classNames(
              fieldControlClass,
              'flex flex-wrap items-center gap-1.5 py-2',
              errors.coins && 'border-negative',
            )}
          >
            {coins.map((coin) => (
              <span
                key={coin}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-raised py-0.5 pr-1 pl-2 font-mono text-[11px] font-semibold text-primary"
              >
                ${coin}
                <button
                  type="button"
                  aria-label={formatCopy(f.removeCoin, { coin })}
                  title={formatCopy(f.removeCoin, { coin })}
                  onClick={() => setCoins((l) => l.filter((x) => x !== coin))}
                  className="rounded-full p-0.5 text-muted-dim hover:bg-raised-hover hover:text-fg-2"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              id={listId + '-coin'}
              list={listId + '-coins'}
              value={coinText}
              disabled={coins.length >= COINS_MAX}
              placeholder={coins.length >= COINS_MAX ? '' : f.coinsPlaceholder}
              onChange={(e) => {
                const value = e.target.value;
                if (value.endsWith(',')) addCoin(value.slice(0, -1));
                else setCoinText(value);
              }}
              onKeyDown={onCoinKey}
              onBlur={() => coinText && addCoin(coinText)}
              aria-invalid={errors.coins ? true : undefined}
              aria-describedby={listId + '-coin-note'}
              className="min-w-24 flex-1 bg-transparent text-sm uppercase outline-none placeholder:text-muted-x placeholder:normal-case"
            />
            <datalist id={listId + '-coins'}>
              {coinSuggestions
                .filter((s) => !coins.includes(s))
                .map((s) => (
                  <option key={s} value={s} />
                ))}
            </datalist>
          </div>
          <span
            id={listId + '-coin-note'}
            className={errors.coins ? fieldErrorClass : fieldHintClass}
          >
            {errors.coins ?? f.coinsHint}
          </span>
        </div>
        <Select
          label={f.market}
          value={market}
          onChange={(e) => setMarket(e.target.value as MarketType | '')}
        >
          <option value="">{f.marketNone}</option>
          <option value="spot">{c.marketSpot}</option>
          <option value="futures">{c.marketFutures}</option>
        </Select>
      </div>

      <fieldset>
        <legend className={fieldLabelClass}>{f.media}</legend>
        <p className={classNames(fieldHintClass, 'mt-0 mb-2')}>{f.mediaHint}</p>
        {media.length > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {media.map((item) => (
              <li
                key={item.key}
                className={classNames(
                  'relative overflow-hidden rounded-lg border bg-raised',
                  item.status === 'error'
                    ? 'border-negative-line'
                    : 'border-line',
                  item.kind === 'VIDEO' && 'col-span-2',
                )}
              >
                <div className="flex aspect-video items-center justify-center">
                  {item.preview ? (
                    <img
                      src={item.preview}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Video
                      size={22}
                      aria-hidden="true"
                      className="text-muted"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5 border-t border-line px-2 py-1.5 text-[11px]">
                  {item.status === 'uploading' && (
                    <Loader2
                      size={11}
                      aria-hidden="true"
                      className="animate-spin text-primary motion-reduce:animate-none"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-fg-2">
                    {item.status === 'uploading'
                      ? formatCopy(f.uploading, {
                          percent: Math.round(item.progress * 100),
                        })
                      : item.name}
                  </span>
                  <button
                    type="button"
                    aria-label={formatCopy(f.removeMedia, { name: item.name })}
                    title={formatCopy(f.removeMedia, { name: item.name })}
                    onClick={() => removeMedia(item.key)}
                    className="rounded p-0.5 text-muted-dim hover:bg-raised-hover hover:text-negative"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
                {item.status === 'uploading' && (
                  <div
                    role="progressbar"
                    aria-label={item.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                    className="absolute inset-x-0 top-0 h-0.5 bg-line"
                  >
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${String(item.progress * 100)}%` }}
                    />
                  </div>
                )}
                {item.error && (
                  <p
                    role="alert"
                    className="px-2 pb-1.5 text-[11px] text-negative"
                  >
                    {item.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={hasVideo || images >= IMAGES_MAX}
            onClick={() => imageInput.current?.click()}
          >
            <ImagePlus size={13} aria-hidden="true" />
            {f.addImages}
          </Button>
          {videoAllowed ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={media.length > 0}
              onClick={() => videoInput.current?.click()}
            >
              <Video size={13} aria-hidden="true" />
              {f.addVideo}
            </Button>
          ) : (
            <Link
              to="/subscription"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-[11px] font-semibold text-muted-x no-underline hover:text-fg-2"
              title={f.videoLocked}
            >
              <Lock size={11} aria-hidden="true" />
              {f.addVideo}
              <span className="sr-only"> — {f.videoLocked}</span>
            </Link>
          )}
          {!videoAllowed && (
            <span className="text-[11px] text-muted-dim">{f.videoLocked}</span>
          )}
        </div>
        <input
          ref={imageInput}
          type="file"
          accept={IMAGE_TYPES}
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files, 'IMAGE');
            e.target.value = '';
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept={VIDEO_TYPES}
          hidden
          onChange={(e) => {
            addFiles(e.target.files, 'VIDEO');
            e.target.value = '';
          }}
        />
        {errors.media && (
          <span role="alert" className={fieldErrorClass}>
            {errors.media}
          </span>
        )}
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {f.cancel}
        </Button>
        <Button type="submit" disabled={pending || uploading}>
          {post ? f.save : f.publish}
        </Button>
      </div>
    </form>
  );
}
