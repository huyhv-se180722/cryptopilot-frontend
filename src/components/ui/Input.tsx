import { useId, type ComponentPropsWithRef } from 'react';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldInlineBoxClass,
  fieldInlineControlClass,
  fieldInlineLabelClass,
  fieldLabelClass,
} from './field-styles';

type Props = ComponentPropsWithRef<'input'> & {
  label: string;
  error?: string | undefined;
  hint?: string;
  /** The label inside the box at the left, the value at the right. */
  inline?: boolean;
};

export function Input({
  label,
  error,
  hint,
  inline = false,
  id,
  className,
  ...props
}: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const description =
    [
      props['aria-describedby'],
      hint ? inputId + '-hint' : undefined,
      error ? inputId + '-error' : undefined,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const input = (
    <input
      {...props}
      id={inputId}
      className={inline ? fieldInlineControlClass : fieldControlClass}
      aria-invalid={error ? true : props['aria-invalid']}
      aria-describedby={description}
    />
  );
  return (
    <div className={className}>
      {inline ? (
        <div className={fieldInlineBoxClass}>
          <label htmlFor={inputId} className={fieldInlineLabelClass}>
            {label}
          </label>
          {input}
        </div>
      ) : (
        <>
          <label htmlFor={inputId} className={fieldLabelClass}>
            {label}
          </label>
          {input}
        </>
      )}
      {hint && !error && (
        <span className={fieldHintClass} id={inputId + '-hint'}>
          {hint}
        </span>
      )}
      {error && (
        <span className={fieldErrorClass} id={inputId + '-error'}>
          {error}
        </span>
      )}
    </div>
  );
}
