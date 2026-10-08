import { useEffect, useId, useRef, type PropsWithChildren } from 'react';
import { Button } from './Button';
import { useCopy } from '../../hooks/use-copy';

/** Native modal provides focus containment, inert background and Escape support. */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
}: PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}>) {
  const copy = useCopy();
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
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        if (open) onOpenChange(false);
      }}
    >
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {copy.common.close}
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export { Dialog as Modal };
