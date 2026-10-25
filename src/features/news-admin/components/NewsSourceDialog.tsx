import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import { Switch } from '../../../components/ui/Switch';
import { useCopy } from '../../../hooks/use-copy';
import type { NewsSource } from '../../../types/domain';
import { applyServerFieldErrors } from '../../../utils/server-field-errors';
import { useSaveSource } from '../hooks/use-news-admin';
import { newsAdminErrorText } from '../news-admin-errors';
import {
  SOURCE_FIELDS,
  sourceFieldError,
  sourceSchema,
  toSourceDraft,
  toSourceValues,
  type SourceFormValues,
} from '../schemas';

/**
 * Add or edit a news source (SRS 3.11.6, UC-49): name, feed URL (read once
 * by the server before it is saved), interval of at least 15 minutes
 * (BR-49), on or off, and the optional reading settings of the outlet.
 * `source` null with `open` adds one.
 */
export function NewsSourceDialog({
  open,
  source,
  onClose,
  onSaved,
}: {
  open: boolean;
  source: NewsSource | null;
  onClose: () => void;
  onSaved: (created: boolean) => void;
}) {
  const copy = useCopy();
  const n = copy.newsAdmin;
  const formId = useId();
  const save = useSaveSource(source?.id ?? null);
  const resetSave = save.reset;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<SourceFormValues>({
    resolver: zodResolver(sourceSchema),
    defaultValues: toSourceValues(source),
  });

  // Each opening starts from the source it edits, or from blank.
  useEffect(() => {
    if (open) {
      reset(toSourceValues(source));
      resetSave();
    }
  }, [open, source, reset, resetSave]);

  const failure =
    save.state.status === 'error' &&
    !SOURCE_FIELDS.some((field) => errors[field]?.type === 'server')
      ? newsAdminErrorText(copy, save.state.error)
      : null;

  const field = (name: (typeof SOURCE_FIELDS)[number], label: string) =>
    sourceFieldError(copy, errors[name]?.message, name, label);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !save.pending && onClose()}
      title={source ? n.editTitle : n.newTitle}
      size="lg"
      footer={
        <>
          <Button variant="secondary" disabled={save.pending} onClick={onClose}>
            {n.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={save.pending}>
            {save.pending && (
              <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            )}
            {save.pending ? n.saving : n.save}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="grid gap-4"
        onSubmit={handleSubmit(async (values) => {
          const result = await save.run(toSourceDraft(values));
          if (result.status === 'success') onSaved(source === null);
          else if (result.status === 'error')
            applyServerFieldErrors(result.error, SOURCE_FIELDS, setError);
        })}
      >
        {failure && <FormNotice tone="error">{failure}</FormNotice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            {...register('sourceName')}
            label={n.nameLabel}
            maxLength={100}
            disabled={save.pending}
            error={field('sourceName', n.nameLabel)}
          />
          <Input
            {...register('crawlIntervalMinutes')}
            label={n.intervalLabel}
            inputMode="numeric"
            hint={n.intervalHint}
            disabled={save.pending}
            error={field('crawlIntervalMinutes', n.intervalLabel)}
          />
        </div>
        <Input
          {...register('feedUrl')}
          label={n.feedUrlLabel}
          type="url"
          placeholder="https://"
          maxLength={1000}
          disabled={save.pending}
          error={field('feedUrl', n.feedUrlLabel)}
        />
        <Switch
          {...register('active')}
          label={n.activeLabel}
          disabled={save.pending}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            {...register('categoryFilter')}
            label={n.categoryLabel}
            hint={n.categoryHint}
            maxLength={256}
            disabled={save.pending}
            error={field('categoryFilter', n.categoryLabel)}
          />
          <Input
            {...register('userAgent')}
            label={n.userAgentLabel}
            maxLength={256}
            disabled={save.pending}
            error={field('userAgent', n.userAgentLabel)}
          />
          <Input
            {...register('bodySelector')}
            label={n.bodySelectorLabel}
            hint={n.bodySelectorHint}
            maxLength={512}
            disabled={save.pending}
            error={field('bodySelector', n.bodySelectorLabel)}
          />
          <Input
            {...register('excludedSelectors')}
            label={n.excludedLabel}
            maxLength={1024}
            disabled={save.pending}
            error={field('excludedSelectors', n.excludedLabel)}
          />
        </div>
      </form>
    </Dialog>
  );
}
