import { useId, useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { useCopy } from '../../../../hooks/use-copy';

/** Asks for the text of a text drawing before it is created. */
export function DrawingTextDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const d = useCopy().drawing;
  const id = useId();
  const [text, setText] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={d.textTitle}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {d.cancel}
          </Button>
          <Button
            disabled={text.trim() === ''}
            onClick={() => onSubmit(text.trim())}
          >
            {d.add}
          </Button>
        </>
      }
    >
      <label htmlFor={id} className="sr-only">
        {d.text}
      </label>
      <textarea
        id={id}
        value={text}
        maxLength={500}
        rows={3}
        autoFocus
        placeholder={d.textPlaceholder}
        onChange={(event) => setText(event.target.value)}
        className="w-full rounded-md border border-line bg-raised px-2 py-1.5 text-sm text-fg"
      />
    </Dialog>
  );
}
