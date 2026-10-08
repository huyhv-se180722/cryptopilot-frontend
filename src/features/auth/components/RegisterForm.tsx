import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Button } from '../../../components/ui/Button';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import {
  registerSchema,
  type RegisterForm as RegisterValues,
} from '../schemas';
import { applyServerFieldErrors } from '../server-errors';
import { useRegister } from '../hooks/use-auth-actions';
import { AuthHeading } from './AuthHeading';
import { FormNotice } from './FormNotice';
import { PasswordRules } from './PasswordRules';
import { ResendVerification } from './ResendVerification';
import { StatusPanel } from './StatusPanel';

const FIELDS = [
  'email',
  'displayName',
  'password',
  'confirmPassword',
  'acceptsDisclaimer',
] as const;

/**
 * SCR-02 (Figma Register). Registration never signs in: success shows the
 * check-your-mailbox state with MSG05 and a resend action (SRS 3.2.1).
 */
export function RegisterForm() {
  const copy = useCopy();
  const action = useRegister();
  const [bannerError, setBannerError] = useState<unknown>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      displayName: '',
      password: '',
      confirmPassword: '',
      acceptsDisclaimer: false,
    },
  });
  const password = useWatch({ control, name: 'password' });
  const labels: Record<(typeof FIELDS)[number], string> = {
    email: copy.auth.emailLabel,
    displayName: copy.auth.displayNameLabel,
    password: copy.auth.passwordLabel,
    confirmPassword: copy.auth.confirmPasswordLabel,
    acceptsDisclaimer: copy.auth.disclaimerField,
  };
  const errorOf = (field: (typeof FIELDS)[number]) => {
    const id = errors[field]?.message;
    return id ? fieldErrorText(copy, id, labels[field]) : undefined;
  };

  if (registeredEmail)
    return (
      <StatusPanel
        tone="mail"
        title={copy.auth.checkMailboxTitle}
        message={messageText(copy, 'MSG05', [], { email: registeredEmail })}
      >
        <ResendVerification email={registeredEmail} />
        <Link
          to="/login"
          className={buttonClassName('primary', 'lg', 'w-full')}
        >
          {copy.auth.goToLogin}
        </Link>
      </StatusPanel>
    );

  return (
    <>
      <AuthHeading
        title={copy.auth.registerTitle}
        subtitle={copy.auth.registerSubtitle}
      />
      {bannerError !== null && (
        <FormNotice tone="error">{errorText(copy, bannerError)}</FormNotice>
      )}
      <form
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setBannerError(null);
          const result = await action.run(values);
          if (result.status === 'success')
            setRegisteredEmail(values.email.trim());
          else if (
            result.status === 'error' &&
            !applyServerFieldErrors(result.error, FIELDS, setError)
          )
            setBannerError(result.error);
        })}
      >
        <Input
          {...register('displayName')}
          className="mb-4"
          autoComplete="nickname"
          label={copy.auth.displayNameLabel}
          placeholder={copy.auth.displayNamePlaceholder}
          disabled={action.pending}
          error={errorOf('displayName')}
        />
        <Input
          {...register('email')}
          className="mb-4"
          type="email"
          autoComplete="email"
          label={copy.auth.emailLabel}
          placeholder={copy.auth.emailPlaceholder}
          disabled={action.pending}
          error={errorOf('email')}
        />
        <div className="mb-4">
          <PasswordInput
            {...register('password')}
            autoComplete="new-password"
            label={copy.auth.passwordLabel}
            placeholder={copy.auth.newPasswordPlaceholder}
            disabled={action.pending}
            error={errorOf('password')}
          />
          <PasswordRules password={password} />
        </div>
        <PasswordInput
          {...register('confirmPassword')}
          className="mb-5"
          autoComplete="new-password"
          label={copy.auth.confirmPasswordLabel}
          placeholder={copy.auth.confirmPasswordPlaceholder}
          disabled={action.pending}
          error={errorOf('confirmPassword')}
        />
        <Checkbox
          {...register('acceptsDisclaimer')}
          className="mb-6"
          label={copy.auth.disclaimerConsent}
          disabled={action.pending}
          error={errorOf('acceptsDisclaimer')}
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
          {action.pending
            ? copy.auth.registerPending
            : copy.auth.registerSubmit}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-dim">
        {copy.auth.haveAccount}{' '}
        <Link to="/login" className="font-medium text-primary no-underline">
          {copy.auth.signInLink}
        </Link>
      </p>
    </>
  );
}
