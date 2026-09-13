import { useId, type SelectHTMLAttributes } from 'react';
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};
export function Select({ label, error, id, children, ...props }: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const description =
    [props['aria-describedby'], error ? selectId + '-error' : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={selectId}>{label}</label>
      <select
        {...props}
        id={selectId}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={description}
      >
        {children}
      </select>
      {error && (
        <span className="field-error" id={selectId + '-error'}>
          {error}
        </span>
      )}
    </div>
  );
}
