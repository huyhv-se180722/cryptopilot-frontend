import { useId, type InputHTMLAttributes } from 'react';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
} from './field-styles';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Input({ label, error, hint, id, className, ...props }: Props) {
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
  return (
    <div className={className}>
      <label htmlFor={inputId} className={fieldLabelClass}>
        {label}
      </label>
      <input
        {...props}
        id={inputId}
        className={fieldControlClass}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={description}
      />
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
