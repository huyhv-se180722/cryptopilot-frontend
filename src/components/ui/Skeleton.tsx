import { classNames } from '../../utils/class-names';

/** Placeholder block shaped like the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        'block animate-pulse rounded-md bg-raised',
        className ?? 'h-4 w-full',
      )}
    />
  );
}
