import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useCopy } from '../../hooks/use-copy';
import { classNames } from '../../utils/class-names';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const tones: Record<ToastTone, { box: string; icon: typeof Info }> = {
  success: { box: 'border-positive-line text-positive', icon: CheckCircle2 },
  error: { box: 'border-negative-line text-negative', icon: AlertCircle },
  info: { box: 'border-primary-line text-primary', icon: Info },
};

/** Errors stay longer: they usually carry a reference to report. */
const DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  error: 8000,
};

function Toast({
  toast,
  paused,
  onDismiss,
}: {
  toast: ToastItem;
  paused: boolean;
  onDismiss: (id: number) => void;
}) {
  const copy = useCopy();
  const remaining = useRef(DURATION[toast.tone]);
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, onDismiss, toast.id]);
  const { box, icon: Icon } = tones[toast.tone];
  return (
    <li
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={classNames(
        'pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface px-4 py-3 text-sm shadow-overlay',
        box,
      )}
    >
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 text-fg">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={copy.common.close}
        className="-mr-1 shrink-0 rounded-md p-0.5 text-muted hover:text-fg-2"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Toast stack for SRS 5.3 toast messages: bottom right, above the mobile
 * dock below lg. Hovering or focusing the stack pauses the timers.
 */
export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: readonly ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <ol
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col gap-2 sm:left-auto sm:w-96 lg:bottom-6"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          paused={paused}
          onDismiss={onDismiss}
        />
      ))}
    </ol>
  );
}
