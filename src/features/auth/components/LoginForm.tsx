import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Button } from '../../../components/ui/Button';
import { useCopy } from '../../../hooks/use-copy';
import {
  errorText,
  fieldErrorText,
  isUnexpectedError,
} from '../../../i18n/messages';
import { useToast } from '../../../hooks/use-toast';
import { problemOf } from '../../../services/api/errors';
import { loginSchema, type LoginForm as LoginValues } from '../schemas';
import { useLogin } from '../hooks/use-auth-actions';
import { AuthHeading } from './AuthHeading';
import { FormNotice } from '../../../components/feedback/FormNotice';

/**
 * SCR-04 (Figma Login). Refusals are shown inline without saying which
 * field was wrong (MSG08); MSG11 offers the resend action.
 */
export function LoginForm() {
  const copy = useCopy();
  const login = useLogin();
  const { show } = useToast();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });
  const error = login.state.status === 'error' ? login.state.error : null;
  // MSG43 goes to a toast (SRS 5.3); the sign-in refusals stay inline.
  const failure =
    error !== null && !isUnexpectedError(copy, error) ? error : null;
  const unverified = problemOf(failure)?.code === 'EMAIL_NOT_VERIFIED';
  const locked = problemOf(failure)?.code === 'LOGIN_TEMPORARILY_LOCKED';
  const fieldError = (message: string | undefined, label: string) =>
    message ? fieldErrorText(copy, message, label) : undefined;

  return (
    <>
      <AuthHeading
        title={copy.auth.loginTitle}
        subtitle={copy.auth.loginSubtitle}
      />
      {failure !== null && (
        <FormNotice tone="error">
          {errorText(copy, failure)}
          {unverified && (
            <>
              {' '}
              <Link
                to="/verify-email"
                state={{ email: getValues('email') }}
                className="font-medium"
              >
                {copy.auth.resendVerification}
              </Link>
            </>
          )}
        </FormNotice>
      )}
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          const result = await login.run(values);
          if (
            result.status === 'error' &&
            isUnexpectedError(copy, result.error)
          )
            show({ tone: 'error', message: errorText(copy, result.error) });
        })}
      >
        <Input
          {...register('email')}
          className="mb-4"
          type="email"
          autoComplete="email"
          label={copy.auth.emailLabel}
          placeholder={copy.auth.emailPlaceholder}
          disabled={login.pending}
          {...(fieldError(errors.email?.message, copy.auth.emailLabel)
            ? { error: fieldError(errors.email?.message, copy.auth.emailLabel) }
            : {})}
        />
        <PasswordInput
          {...register('password')}
          className="mb-2"
          autoComplete="current-password"
          label={copy.auth.passwordLabel}
          placeholder={copy.auth.passwordPlaceholder}
          disabled={login.pending}
          {...(fieldError(errors.password?.message, copy.auth.passwordLabel)
            ? {
                error: fieldError(
                  errors.password?.message,
                  copy.auth.passwordLabel,
                ),
              }
            : {})}
        />
        <div className="mb-6 flex items-center justify-between gap-3">
          <Checkbox
            {...register('rememberMe')}
            label={copy.auth.rememberMe}
            disabled={login.pending}
          />
          <Link
            to="/forgot-password"
            className="shrink-0 text-xs text-primary no-underline hover:underline"
          >
            {copy.auth.forgotLink}
          </Link>
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={login.pending || locked}
        >
          {login.pending && (
            <Loader2 size={15} aria-hidden="true" className="animate-spin" />
          )}
          {login.pending ? copy.auth.loginPending : copy.auth.loginSubmit}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-dim">
        {copy.auth.noAccount}{' '}
        <Link to="/register" className="font-medium text-primary no-underline">
          {copy.auth.createAccountLink}
        </Link>
      </p>
    </>
  );
}
