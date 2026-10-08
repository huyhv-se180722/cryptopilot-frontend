import type { PropsWithChildren } from 'react';
import { AlertTriangle, Check, Loader2, Mail } from 'lucide-react';
import { classNames } from '../../../utils/class-names';

type Tone = 'success' | 'warning' | 'pending' | 'mail';

const tones: Record<Tone, { ring: string; icon: typeof Check }> = {
  success: {
    ring: 'border-positive-line bg-positive-soft text-positive',
    icon: Check,
  },
  warning: {
    ring: 'border-warning-line bg-warning-soft text-warning',
    icon: AlertTriangle,
  },
  pending: {
    ring: 'border-primary-line bg-primary-soft text-primary',
    icon: Loader2,
  },
  mail: {
    ring: 'border-primary-line bg-primary-soft text-primary',
    icon: Mail,
  },
};

/** Figma "Account created" result layout: round icon, title, message, actions. */
export function StatusPanel({
  tone,
  title,
  message,
  children,
}: PropsWithChildren<{ tone: Tone; title: string; message?: string }>) {
  const { ring, icon: Icon } = tones[tone];
  return (
    <div className="text-center" role={tone === 'warning' ? 'alert' : 'status'}>
      <div
        className={classNames(
          'mx-auto mb-6 flex size-14 items-center justify-center rounded-full border',
          ring,
        )}
      >
        <Icon
          size={24}
          aria-hidden="true"
          className={tone === 'pending' ? 'animate-spin' : undefined}
        />
      </div>
      <h1 className="mb-2 text-xl font-semibold">{title}</h1>
      {message && <p className="mb-6 text-sm text-muted-dim">{message}</p>}
      {children && <div className="space-y-3 text-left">{children}</div>}
    </div>
  );
}
