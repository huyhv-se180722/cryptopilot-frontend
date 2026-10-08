import {
  useEffect,
  useId,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { classNames } from '../../utils/class-names';
import { useCopy } from '../../hooks/use-copy';

type Accent = 'primary' | 'negative' | 'warning' | 'positive';

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;
const accents: Record<Accent, string> = {
  primary: 'from-primary',
  negative: 'from-negative',
  warning: 'from-warning',
  positive: 'from-positive',
};

/**
 * Figma ConfirmDialog look on the native <dialog>, which provides focus
 * containment, an inert background and Escape support.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = 'md',
  accent = 'primary',
  children,
}: PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: keyof typeof widths;
  accent?: Accent;
}>) {
  const copy = useCopy();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={classNames(
        'm-auto w-[calc(100vw-32px)] rounded-2xl border border-line-strong bg-surface p-6 text-fg shadow-overlay backdrop:bg-(--cp-backdrop) backdrop:backdrop-blur-sm',
        widths[size],
      )}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        if (open) onOpenChange(false);
      }}
    >
      <div
        aria-hidden="true"
        className={classNames(
          'mb-4 h-px rounded-full bg-linear-to-r to-transparent',
          accents[accent],
        )}
      />
      <div className="mb-2 flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-sm font-semibold text-fg">
          {title}
        </h2>
        <button
          type="button"
          aria-label={copy.common.close}
          title={copy.common.close}
          onClick={() => onOpenChange(false)}
          className="-mt-1 -mr-1 inline-flex size-7 items-center justify-center rounded-lg text-muted-dim hover:bg-raised hover:text-fg-2"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      {description && (
        <p
          id={descriptionId}
          className="mb-5 text-xs leading-relaxed text-muted"
        >
          {description}
        </p>
      )}
      {children}
      {footer && (
        <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>
      )}
    </dialog>
  );
}
export { Dialog as Modal };
