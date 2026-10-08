import { classNames } from '../../utils/class-names';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold no-underline disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:enabled:opacity-90 dark:shadow-glow-primary',
  secondary:
    'border border-line-strong bg-raised text-fg-2 hover:enabled:bg-raised-hover',
  ghost: 'text-muted hover:enabled:bg-raised hover:enabled:text-fg-2',
  danger: 'bg-negative text-white hover:enabled:opacity-90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[11px]',
  md: 'h-9 px-4 text-xs',
  lg: 'h-11 px-5 text-sm',
};

/** Button look for <button> and router <Link> alike. */
export function buttonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return classNames(base, variants[variant], sizes[size], className);
}
