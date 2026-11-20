import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText } from '../../../i18n/messages';
import { useUploadChartImage } from '../hooks/use-journal-entry';

/** The formats the backend signs for a chart image (JPG, PNG, WEBP). */
const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * The chart image of a review (SCR-21, UC-23): add, replace or remove. A
 * new file is uploaded at once with a signed form and its key kept for
 * the review; the review's save attaches it (MSG32 when refused).
 */
export function ChartImageField({
  tradeId,
  savedUrl,
  savedKey,
  imageKey,
  onKey,
  alt,
}: {
  tradeId: string;
  /** The image the trade has now, and its key. */
  savedUrl: string | null;
  savedKey: string | null;
  /** The key the review will send. */
  imageKey: string | null;
  onKey: (key: string | null) => void;
  alt: string;
}) {
  const copy = useCopy();
  const j = copy.journal;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadChartImage(tradeId);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown =
    imageKey === null ? null : imageKey === savedKey ? savedUrl : preview;
  const choose = (file: File | undefined) => {
    if (!file) return;
    setProgress(0);
    upload.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: (key) => {
          setPreview(
            typeof URL.createObjectURL === 'function'
              ? URL.createObjectURL(file)
              : null,
          );
          onKey(key);
        },
        onSettled: () => setProgress(null),
      },
    );
  };

  return (
    <div>
      <span className={fieldLabelClass} id={id + '-label'}>
        {j.chartImage}
      </span>
      {shown && (
        <img
          src={shown}
          alt={alt}
          className="mb-2 max-h-64 w-full rounded-lg border border-line object-contain"
        />
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-labelledby={id + '-label'}
        tabIndex={-1}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={13} aria-hidden="true" />
          {imageKey === null ? j.chartImageAdd : j.chartImageReplace}
        </Button>
        {imageKey !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={upload.isPending}
            onClick={() => onKey(null)}
          >
            <Trash2 size={13} aria-hidden="true" />
            {j.chartImageRemove}
          </Button>
        )}
      </div>
      {progress !== null ? (
        <span role="status" className={fieldHintClass}>
          {formatCopy(j.chartImageUploading, {
            percent: Math.round(progress * 100),
          })}
        </span>
      ) : upload.isError ? (
        <span role="alert" className={fieldErrorClass}>
          {errorText(copy, upload.error)}
        </span>
      ) : imageKey !== savedKey ? (
        <span role="status" className={fieldHintClass}>
          {imageKey === null ? j.chartImageWillRemove : j.chartImageUploaded}
        </span>
      ) : (
        <span className={fieldHintClass}>{j.chartImageHint}</span>
      )}
    </div>
  );
}
