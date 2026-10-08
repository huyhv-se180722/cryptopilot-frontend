import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { classNames } from '../../utils/class-names';
import { useCopy } from '../../hooks/use-copy';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldLabelClass,
} from './field-styles';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
};

/** Figma login password field with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  function PasswordInput({ label, error, id, className, ...props }, ref) {
    const copy = useCopy();
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    const description =
      [props['aria-describedby'], error ? inputId + '-error' : undefined]
        .filter(Boolean)
        .join(' ') || undefined;
    return (
      <div className={className}>
        <label htmlFor={inputId} className={fieldLabelClass}>
          {label}
        </label>
        <div className="relative">
          <input
            {...props}
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            aria-describedby={description}
            className={classNames(fieldControlClass, 'pr-11')}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={
              visible ? copy.auth.hidePassword : copy.auth.showPassword
            }
            aria-pressed={visible}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-dim hover:text-fg-2"
          >
            {visible ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        {error && (
          <span className={fieldErrorClass} id={inputId + '-error'}>
            {error}
          </span>
        )}
      </div>
    );
  },
);
