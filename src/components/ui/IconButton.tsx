import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../utils/class-names';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Accessible name; also shown as the native tooltip. */
  label: string;
  icon: ReactNode;
  active?: boolean;
  outlined?: boolean;
};

/** Square 32px icon control used across the shells (Figma TopNav). */
export function IconButton({
  label,
  icon,
  active = false,
  outlined = false,
  className,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={classNames(
        'relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg pointer-coarse:size-11',
        outlined && 'border border-line bg-raised',
        active
          ? 'bg-raised text-primary'
          : 'text-muted-dim hover:bg-raised hover:text-fg-2',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
