import type { ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

type Accent =
  'primary' | 'positive' | 'negative' | 'warning' | 'accent' | 'purple';

const accents: Record<Accent, string> = {
  primary: 'border-t-primary',
  positive: 'border-t-positive',
  negative: 'border-t-negative',
  warning: 'border-t-warning',
  accent: 'border-t-accent',
  purple: 'border-t-purple',
};

/** Figma StatCard: 2px accent top border, 12px label (D-161), mono value. */
export function StatCard({
  label,
  value,
  status,
  accent = 'primary',
}: {
  label: string;
  value: ReactNode;
  status?: ReactNode;
  accent?: Accent;
}) {
  return (
    <div
      className={classNames(
        'rounded-xl border border-t-2 border-line bg-surface px-4 py-3.5',
        accents[accent],
      )}
    >
      <dl>
        <dt className="mb-2 text-xs font-medium text-muted-x">{label}</dt>
        <dd className="m-0 font-mono text-xl leading-none font-semibold text-fg">
          {value}
        </dd>
      </dl>
      {status && <div className="mt-1.5 text-xs text-muted-dim">{status}</div>}
    </div>
  );
}
