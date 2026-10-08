import type { PropsWithChildren } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { classNames } from '../../../utils/class-names';

type Tone = 'error' | 'success' | 'info';

const tones: Record<Tone, { box: string; icon: typeof Info }> = {
  error: {
    box: 'border-negative-line bg-negative-soft text-negative',
    icon: AlertCircle,
  },
  success: {
    box: 'border-positive-line bg-positive-soft text-positive',
    icon: CheckCircle2,
  },
  info: { box: 'border-primary-line bg-primary-soft text-primary', icon: Info },
};

/** Figma login banner (error / success / info), 14px text with an icon. */
export function FormNotice({
  tone,
  children,
}: PropsWithChildren<{ tone: Tone }>) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={classNames(
        'mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
        box,
      )}
    >
      <Icon size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
