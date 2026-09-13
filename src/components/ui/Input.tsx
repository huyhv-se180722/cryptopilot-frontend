import { useId, type InputHTMLAttributes } from 'react';
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};
export function Input({ label, error, id, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const description =
    [props['aria-describedby'], error ? inputId + '-error' : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={description}
      />
      {error && (
        <span className="field-error" id={inputId + '-error'}>
          {error}
        </span>
      )}
    </div>
  );
}
