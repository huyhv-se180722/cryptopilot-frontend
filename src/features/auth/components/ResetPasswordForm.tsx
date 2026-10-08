import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Button } from '../../../components/ui/Button';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useFormFeedback } from '../../../hooks/use-form-feedback';
import { useToast } from '../../../hooks/use-toast';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import {
  resetPasswordSchema,
  type ResetPasswordForm as ResetValues,
} from '../schemas';
import { applyServerFieldErrors } from '../server-errors';
import { useResetPassword } from '../hooks/use-auth-actions';
import { AuthHeading } from './AuthHeading';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { PasswordRules } from './PasswordRules';
import { StatusPanel } from './StatusPanel';

const FIELDS = ['newPassword', 'confirmPassword'] as const;

/**
 * SCR-06. Sets a new password from the emailed link; success revokes
 * every session, shows MSG13 (a toast, SRS 5.3) and returns to sign in.
 */
export function ResetPasswordForm() {
  const copy = useCopy();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const action = useResetPassword();
  const feedback = useFormFeedback();
  const { show } = useToast();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'newPassword' });

  const invalidLink =
    !token ||
    problemOf(feedback.inline?.error)?.code === 'TOKEN_INVALID_OR_EXPIRED';
  if (invalidLink)
    return (
      <StatusPanel
        tone="warning"
        title={copy.auth.verifyFailedTitle}
        message={messageText(copy, 'MSG07')}
      >
        <Link
          to="/forgot-password"
          className={buttonClassName('primary', 'lg', 'w-full')}
        >
          {copy.auth.requestNewLink}
        </Link>
      </StatusPanel>
    );

  const errorOf = (field: (typeof FIELDS)[number], label: string) => {
    const id = errors[field]?.message;
    return id ? fieldErrorText(copy, id, label) : undefined;
  };
  return (
    <>
      <AuthHeading
        title={copy.auth.resetTitle}
        subtitle={copy.auth.resetSubtitle}
      />
      {feedback.inline && (
        <FormNotice tone="error">
          {errorText(copy, feedback.inline.error)}
        </FormNotice>
      )}
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          feedback.clear();
          const result = await action.run({ token, ...values });
          if (result.status === 'success') {
            show({ tone: 'success', message: messageText(copy, 'MSG13') });
            navigate('/login', { replace: true });
          } else if (
            result.status === 'error' &&
            !applyServerFieldErrors(result.error, FIELDS, setError)
          )
            feedback.failed(result.error);
        })}
      >
        <div className="mb-4">
          <PasswordInput
            {...register('newPassword')}
            autoComplete="new-password"
            label={copy.auth.newPasswordLabel}
            placeholder={copy.auth.newPasswordPlaceholder}
            disabled={action.pending}
            error={errorOf('newPassword', copy.auth.newPasswordLabel)}
          />
          <PasswordRules password={password} />
        </div>
        <PasswordInput
          {...register('confirmPassword')}
          className="mb-6"
          autoComplete="new-password"
          label={copy.auth.confirmPasswordLabel}
          placeholder={copy.auth.confirmPasswordPlaceholder}
          disabled={action.pending}
          error={errorOf('confirmPassword', copy.auth.confirmPasswordLabel)}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={action.pending}
        >
          {action.pending && (
            <Loader2 size={15} aria-hidden="true" className="animate-spin" />
          )}
          {action.pending ? copy.auth.resetPending : copy.auth.resetSubmit}
        </Button>
      </form>
    </>
  );
}
