import { useId, useState, type FormEvent } from 'react';
import { Alert as Banner } from '../../../components/feedback/States';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Input } from '../../../components/ui/Input';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from '../../../components/ui/field-styles';
import { useCopy } from '../../../hooks/use-copy';
import { formatCopy } from '../../../i18n/copy';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import type { WatchlistItem, WatchlistItemUpdate } from '../../../types/domain';
import { pairLabel } from '../../../utils/pair-label';

const LABEL_MAX = 100;
const NOTE_MAX = 1000;

/**
 * Edit the label and note of a row (SRS 3.4.1). An empty value clears it;
 * the limits mirror `UpdateWatchlistItemRequest` (100 and 1000).
 */
export function WatchlistEditDialog({
  item,
  onClose,
  onSave,
}: {
  /** null = closed. */
  item: WatchlistItem | null;
  onClose: () => void;
  /** Resolves with the refusal, if any. */
  onSave: (update: WatchlistItemUpdate) => Promise<unknown>;
}) {
  const w = useCopy().watchlist;
  const formId = useId();
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => !open && onClose()}
      title={formatCopy(w.editTitle, {
        pair: item ? pairLabel(item.symbol) : '',
      })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {w.cancel}
          </Button>
          <Button type="submit" form={formId}>
            {w.save}
          </Button>
        </>
      }
    >
      {item && (
        <EditForm key={item.id} id={formId} item={item} onSave={onSave} />
      )}
    </Dialog>
  );
}

function EditForm({
  id,
  item,
  onSave,
}: {
  id: string;
  item: WatchlistItem;
  onSave: (update: WatchlistItemUpdate) => Promise<unknown>;
}) {
  const copy = useCopy();
  const w = copy.watchlist;
  const noteId = useId();
  const [label, setLabel] = useState(item.label ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [refusal, setRefusal] = useState<unknown>(null);
  const labelError =
    label.length > LABEL_MAX
      ? formatCopy(w.tooLong, { field: w.labelField, max: LABEL_MAX })
      : undefined;
  const noteError =
    note.length > NOTE_MAX
      ? formatCopy(w.tooLong, { field: w.noteField, max: NOTE_MAX })
      : undefined;
  const fields = problemOf(refusal)?.fieldErrors ?? {};

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (labelError || noteError) return;
    setRefusal(await onSave({ label: label.trim(), note: note.trim() }));
  }

  const noteMessage =
    noteError ??
    (fields.note ? fieldErrorText(copy, fields.note, w.noteField) : undefined);
  return (
    <form id={id} onSubmit={(event) => void submit(event)} noValidate>
      <div className="grid gap-4">
        <Input
          label={w.labelField}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          hint={w.labelHint}
          error={
            labelError ??
            (fields.label
              ? fieldErrorText(copy, fields.label, w.labelField)
              : undefined)
          }
          autoComplete="off"
        />
        <div>
          <label htmlFor={noteId} className={fieldLabelClass}>
            {w.noteField}
          </label>
          <textarea
            id={noteId}
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={fieldControlClass}
            aria-invalid={noteMessage ? true : undefined}
            aria-describedby={noteId + '-help'}
          />
          <span
            id={noteId + '-help'}
            className={noteMessage ? fieldErrorClass : fieldHintClass}
          >
            {noteMessage ?? w.noteHint}
          </span>
        </div>
        {refusal !== null && Object.keys(fields).length === 0 && (
          <Banner tone="danger" title={errorText(copy, refusal)} />
        )}
      </div>
    </form>
  );
}

/**
 * MSG26 before a row with alerts is removed (BR-16, D-76). The count is the
 * server's: every alert of the row, not only the active ones.
 */
export function WatchlistRemoveDialog({
  pending,
  busy,
  onCancel,
  onConfirm,
}: {
  /** The row and the alert count the server asked to confirm; null = closed. */
  pending: { item: WatchlistItem; count: number } | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = useCopy();
  const w = copy.watchlist;
  const pair = pending ? pairLabel(pending.item.symbol) : '';
  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={formatCopy(w.removeTitle, { pair })}
      description={
        pending
          ? messageText(copy, 'MSG26', [], { pair, n: pending.count })
          : ''
      }
      accent="negative"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {w.cancel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {w.removeConfirm}
          </Button>
        </>
      }
    />
  );
}
