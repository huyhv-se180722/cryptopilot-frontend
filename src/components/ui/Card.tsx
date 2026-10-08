import type { HTMLAttributes } from 'react';
import { classNames } from '../../utils/class-names';

const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const;

export function Card({
  className,
  padding = 'md',
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: keyof typeof paddings }) {
  return (
    <div
      className={classNames(
        'rounded-xl border border-line bg-surface',
        paddings[padding],
        className,
      )}
      {...props}
    />
  );
}
