import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Button } from '../../../components/ui/Button';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import {
  resetPasswordSchema,
  type ResetPasswordForm as ResetValues,
} from '../schemas';
import { applyServerFieldErrors } from '../server-errors';
import { useResetPassword } from '../hooks/use-auth-actions';
import { AuthHeading } from './AuthHeading';
import { FormNotice } from './FormNotice';
import { PasswordRules } from './PasswordRules';
import { StatusPanel } from './StatusPanel';

const FIELDS = ['newPassword', 'confirmPassword'] as const;
const REDIRECT_MS = 3000;

/**
 * SCR-06 (spec §1). Sets a new password from the emailed link; success
 * revokes every session (MSG13) and returns to sign in.
 */
export function ResetPasswordForm() {
  const copy = useCopy();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const action = useResetPassword();
  const [bannerError, setBannerError] = useState<unknown>(null);
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
  const done = action.state.status === 'success';

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(
      () => navigate('/login', { replace: true }),
      REDIRECT_MS,
    );
    return () => clearTimeout(timer);
  }, [done, navigate]);

  const invalidLink =
    !token || problemOf(bannerError)?.code === 'TOKEN_INVALID_OR_EXPIRED';
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
  if (done)
    return (
      <StatusPanel
        tone="success"
        title={copy.auth.resetDoneTitle}
        message={messageText(copy, 'MSG13') + ' ' + copy.auth.redirecting}
      >
        <Link
          to="/login"
          className={buttonClassName('primary', 'lg', 'w-full')}
        >
          {copy.auth.goToLogin}
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
      {bannerError !== null && (
        <FormNotice tone="error">{errorText(copy, bannerError)}</FormNotice>
      )}
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setBannerError(null);
          const result = await action.run({ token, ...values });
          if (
            result.status === 'error' &&
            !applyServerFieldErrors(result.error, FIELDS, setError)
          )
            setBannerError(result.error);
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
