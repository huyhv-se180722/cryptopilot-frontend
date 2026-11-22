import { useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { classNames } from '../../utils/class-names';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldInlineBoxClass,
  fieldInlineSelectClass,
  fieldInlineLabelClass,
  fieldLabelClass,
} from './field-styles';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | undefined;
  /** The label inside the box at the left, the choice right after it. */
  inline?: boolean;
};

export function Select({
  label,
  error,
  inline = false,
  id,
  className,
  children,
  ...props
}: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const description =
    [props['aria-describedby'], error ? selectId + '-error' : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  if (inline)
    return (
      <div className={className}>
        <div className={classNames(fieldInlineBoxClass, 'relative')}>
          <label htmlFor={selectId} className={fieldInlineLabelClass}>
            {label}
          </label>
          <select
            {...props}
            id={selectId}
            className={fieldInlineSelectClass}
            aria-invalid={error ? true : props['aria-invalid']}
            aria-describedby={description}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            size={14}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-dim"
          />
        </div>
        {error && (
          <span className={fieldErrorClass} id={selectId + '-error'}>
            {error}
          </span>
        )}
      </div>
    );
  return (
    <div className={className}>
      <label htmlFor={selectId} className={fieldLabelClass}>
        {label}
      </label>
      <div className="relative">
        <select
          {...props}
          id={selectId}
          className={classNames(fieldControlClass, 'appearance-none pr-9')}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={description}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          size={14}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-dim"
        />
      </div>
      {error && (
        <span className={fieldErrorClass} id={selectId + '-error'}>
          {error}
        </span>
      )}
    </div>
  );
}
