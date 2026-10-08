import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { classNames } from '../../utils/class-names';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
  label: string;
  description?: string;
};

/** Figma Settings toggle (36×20) on a native checkbox with the switch role. */
export const Switch = forwardRef<HTMLInputElement, Props>(function Switch(
  { label, description, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div
      className={classNames(
        'flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0',
        className,
      )}
    >
      <label htmlFor={inputId} className="min-w-0 cursor-pointer">
        <span className="block text-sm text-fg-2">{label}</span>
        {description && (
          <span
            className="mt-0.5 block text-[11px] text-muted-x"
            id={inputId + '-description'}
          >
            {description}
          </span>
        )}
      </label>
      <span className="relative inline-flex h-5 w-9 shrink-0">
        <input
          {...props}
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          aria-describedby={description ? inputId + '-description' : undefined}
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full bg-line-strong transition-colors checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform peer-checked:translate-x-4"
        />
      </span>
    </div>
  );
});
