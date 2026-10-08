import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { useCopy } from '../../../hooks/use-copy';
import { useFormFeedback } from '../../../hooks/use-form-feedback';
import { errorText, fieldErrorText } from '../../../i18n/messages';
import { problemOf } from '../../../services/api/errors';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { PasswordRules } from './PasswordRules';
import { applyServerFieldErrors } from '../server-errors';
import { useChangePassword } from '../hooks/use-auth-actions';
import { passwordChangeSchema, type PasswordChangeValues } from '../schemas';
import { SectionTitle } from '../../../components/ui/SectionTitle';

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const;
const EMPTY: PasswordChangeValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * SCR-07 Security tab (UC-07, BR-02), also the whole admin account screen.
 * A wrong current password shows MSG08 under that field and keeps the
 * session; success revokes the other sessions and shows MSG14.
 */
export function ChangePasswordForm() {
  const copy = useCopy();
  const p = copy.profile;
  const action = useChangePassword();
  const feedback = useFormFeedback();
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: EMPTY,
  });
  const password = useWatch({ control, name: 'newPassword' });
  const errorOf = (field: (typeof FIELDS)[number], label: string) => {
    const id = errors[field]?.message;
    return id ? fieldErrorText(copy, id, label) : undefined;
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (values) => {
        feedback.clear();
        const result = await action.run(values);
        if (result.status === 'success') {
          reset(EMPTY);
          feedback.saved();
          return;
        }
        if (result.status !== 'error') return;
        if (problemOf(result.error)?.code === 'CURRENT_PASSWORD_INCORRECT')
          setError('currentPassword', { type: 'server', message: 'MSG08' });
        else if (!applyServerFieldErrors(result.error, FIELDS, setError))
          feedback.failed(result.error);
      })}
    >
      {feedback.inline && (
        <FormNotice tone="error">
          {errorText(copy, feedback.inline.error)}
        </FormNotice>
      )}
      <Card padding="lg" className="mb-5 max-w-xl">
        <SectionTitle>{p.securityTitle}</SectionTitle>
        <p className="-mt-2 mb-4 text-xs text-muted-dim">
          {p.securitySubtitle}
        </p>
        <PasswordInput
          {...register('currentPassword')}
          className="mb-4"
          autoComplete="current-password"
          label={p.currentPasswordLabel}
          disabled={action.pending}
          error={errorOf('currentPassword', p.currentPasswordLabel)}
        />
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
          autoComplete="new-password"
          label={copy.auth.confirmPasswordLabel}
          placeholder={copy.auth.confirmPasswordPlaceholder}
          disabled={action.pending}
          error={errorOf('confirmPassword', copy.auth.confirmPasswordLabel)}
        />
      </Card>
      <div className="flex max-w-xl justify-end">
        <Button type="submit" disabled={action.pending}>
          {action.pending && (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          )}
          {action.pending ? p.saving : p.passwordSave}
        </Button>
      </div>
    </form>
  );
}
