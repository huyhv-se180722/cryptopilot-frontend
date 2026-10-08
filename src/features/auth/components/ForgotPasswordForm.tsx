import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { buttonClassName } from '../../../components/ui/button-styles';
import { useCopy } from '../../../hooks/use-copy';
import { useFormFeedback } from '../../../hooks/use-form-feedback';
import { useToast } from '../../../hooks/use-toast';
import { errorText, fieldErrorText, messageText } from '../../../i18n/messages';
import { emailSchema, type EmailForm } from '../schemas';
import { useForgotPassword } from '../hooks/use-auth-actions';
import { AuthHeading } from './AuthHeading';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { StatusPanel } from './StatusPanel';

/**
 * SCR-05. Always answers MSG12 (a toast, SRS 5.3) so the screen never
 * reveals whether an account exists (SRS 3.2.4).
 */
export function ForgotPasswordForm() {
  const copy = useCopy();
  const action = useForgotPassword();
  const feedback = useFormFeedback();
  const { show } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  if (action.state.status === 'success')
    return (
      <StatusPanel
        tone="mail"
        title={copy.auth.forgotSentTitle}
        message={copy.auth.forgotSentBody}
      >
        <Link
          to="/login"
          className={buttonClassName('primary', 'lg', 'w-full')}
        >
          {copy.auth.backToSignIn}
        </Link>
      </StatusPanel>
    );

  const emailError = errors.email?.message;
  return (
    <>
      <AuthHeading
        title={copy.auth.forgotTitle}
        subtitle={copy.auth.forgotSubtitle}
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
          const result = await action.run(values.email);
          if (result.status === 'success')
            show({ tone: 'success', message: messageText(copy, 'MSG12') });
          else if (result.status === 'error') feedback.failed(result.error);
        })}
      >
        <Input
          {...register('email')}
          className="mb-6"
          type="email"
          autoComplete="email"
          label={copy.auth.emailLabel}
          placeholder={copy.auth.emailPlaceholder}
          disabled={action.pending}
          error={
            emailError
              ? fieldErrorText(copy, emailError, copy.auth.emailLabel)
              : undefined
          }
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
          {copy.auth.forgotSubmit}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-primary no-underline">
          {copy.auth.backToSignIn}
        </Link>
      </p>
    </>
  );
}
