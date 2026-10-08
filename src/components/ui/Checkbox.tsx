import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';
import { fieldErrorClass } from './field-styles';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  error?: string | undefined;
};

/** Figma 16px checkbox on a native input (keyboard and form friendly). */
export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { label, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-start gap-2.5 select-none"
      >
        <span className="relative mt-0.5 inline-flex size-4 shrink-0">
          <input
            {...props}
            ref={ref}
            id={inputId}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? inputId + '-error' : undefined}
            className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded border-[1.5px] border-muted-x checked:border-primary checked:bg-primary aria-[invalid=true]:border-negative"
          />
          <Check
            size={10}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto hidden text-white peer-checked:block"
          />
        </span>
        <span className="text-xs leading-relaxed text-muted">{label}</span>
      </label>
      {error && (
        <span
          id={inputId + '-error'}
          className={fieldErrorClass + ' pl-[26px]'}
        >
          {error}
        </span>
      )}
    </div>
  );
});
