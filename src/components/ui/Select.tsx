import { useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { classNames } from '../../utils/class-names';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldFilterControlClass,
  fieldFilterLabelClass,
  fieldInlineBoxClass,
  fieldInlineControlClass,
  fieldInlineLabelClass,
  fieldLabelClass,
} from './field-styles';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | undefined;
  /** The label inside the box at the left, the choice at the right. */
  inline?: boolean;
  /**
   * A filter of a list, as an exchange's order history shows it: the
   * label outside at the left, a compact box as wide as its options with
   * the choice at the left and the arrow at the right.
   */
  filter?: boolean;
};

export function Select({
  label,
  error,
  inline = false,
  filter = false,
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
  if (filter)
    return (
      <div className={classNames('min-w-0', className)}>
        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor={selectId} className={fieldFilterLabelClass}>
            {label}
          </label>
          <div className="relative min-w-0">
            <select
              {...props}
              id={selectId}
              className={fieldFilterControlClass}
              aria-invalid={error ? true : props['aria-invalid']}
              aria-describedby={description}
            >
              {children}
            </select>
            <ChevronDown
              aria-hidden="true"
              size={14}
              className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-dim"
            />
          </div>
        </div>
        {error && (
          <span className={fieldErrorClass} id={selectId + '-error'}>
            {error}
          </span>
        )}
      </div>
    );
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
            className={classNames(
              fieldInlineControlClass,
              'cursor-pointer appearance-none pr-5',
            )}
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
