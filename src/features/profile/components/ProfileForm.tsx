import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useCopy } from '../../../hooks/use-copy';
import { useFormFeedback } from '../../../hooks/use-form-feedback';
import { errorText } from '../../../i18n/messages';
import type { TradingStyle, UserProfile } from '../../../types/domain';
import { FormNotice } from '../../../components/feedback/FormNotice';
import { applyServerFieldErrors } from '../../../utils/server-field-errors';
import { useUpdateProfile } from '../hooks/use-profile';
import {
  RANGES,
  profileFieldError,
  profileSchema,
  toProfileUpdate,
  type ProfileFormValues,
} from '../schemas';
import { SectionTitle } from '../../../components/ui/SectionTitle';

const FIELDS = [
  'displayName',
  'defaultCapital',
  'defaultRiskPercent',
  'tradingStyle',
] as const;
const STYLES: readonly TradingStyle[] = [
  'SCALPING',
  'DAY',
  'SWING',
  'POSITION',
];

function toValues(profile: UserProfile): ProfileFormValues {
  return {
    displayName: profile.displayName,
    defaultCapital: profile.defaultCapital ?? '',
    defaultRiskPercent: profile.defaultRiskPercent ?? '',
    tradingStyle: profile.tradingStyle ?? '',
  };
}

/** SCR-07 Profile tab: account identity and trading defaults (UC-06). */
export function ProfileForm({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => void;
}) {
  const copy = useCopy();
  const action = useUpdateProfile();
  const feedback = useFormFeedback();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toValues(profile),
  });
  const p = copy.profile;
  const initial = profile.displayName.trim().charAt(0).toUpperCase();

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (values) => {
        feedback.clear();
        const update = toProfileUpdate(values);
        const result = await action.run(update);
        if (result.status === 'success') {
          reset({
            ...values,
            defaultCapital: update.defaultCapital ?? '',
            defaultRiskPercent: update.defaultRiskPercent ?? '',
          });
          feedback.saved();
          onSaved();
        } else if (
          result.status === 'error' &&
          !applyServerFieldErrors(result.error, FIELDS, setError)
        )
          feedback.failed(result.error);
      })}
    >
      {feedback.inline && (
        <FormNotice tone="error">
          {errorText(copy, feedback.inline.error)}
        </FormNotice>
      )}
      <Card padding="lg" className="mb-5">
        <SectionTitle>{p.identityTitle}</SectionTitle>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-1.5 sm:w-24">
            <div
              aria-hidden="true"
              className="flex size-14 items-center justify-center rounded-full bg-linear-135 from-primary to-accent text-xl font-bold text-white"
            >
              {initial}
            </div>
            <span className="text-center text-[10px] text-muted-x">
              {p.avatarPending}
            </span>
          </div>
          <div className="grid flex-1 gap-4 lg:grid-cols-2">
            <Input
              {...register('displayName')}
              label={copy.auth.displayNameLabel}
              autoComplete="nickname"
              maxLength={50}
              disabled={action.pending}
              error={profileFieldError(
                copy,
                errors.displayName?.message,
                copy.auth.displayNameLabel,
              )}
            />
            <Input
              label={p.emailLabel}
              value={profile.email}
              readOnly
              hint={p.emailHint}
            />
          </div>
        </div>
      </Card>

      <Card padding="lg" className="mb-5">
        <SectionTitle>{p.defaultsTitle}</SectionTitle>
        <p className="-mt-2 mb-4 text-xs text-muted-dim">{p.defaultsHint}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            {...register('defaultCapital')}
            label={p.capitalLabel + ' (' + p.capitalUnit + ')'}
            inputMode="decimal"
            autoComplete="off"
            placeholder="1000"
            disabled={action.pending}
            error={profileFieldError(
              copy,
              errors.defaultCapital?.message,
              p.capitalLabel,
              RANGES.defaultCapital,
            )}
          />
          <Input
            {...register('defaultRiskPercent')}
            label={p.riskPercentLabel + ' (' + p.percentUnit + ')'}
            inputMode="decimal"
            autoComplete="off"
            placeholder="1"
            hint={p.riskPercentHint}
            disabled={action.pending}
            error={profileFieldError(
              copy,
              errors.defaultRiskPercent?.message,
              p.riskPercentLabel,
              RANGES.defaultRiskPercent,
            )}
          />
          <Select
            {...register('tradingStyle')}
            label={p.styleLabel}
            disabled={action.pending}
            aria-describedby="trading-style-hint"
            error={profileFieldError(
              copy,
              errors.tradingStyle?.message,
              p.styleLabel,
            )}
          >
            <option value="">{p.styleNone}</option>
            {STYLES.map((style) => (
              <option key={style} value={style}>
                {p[`style${style}`]}
              </option>
            ))}
          </Select>
          <p
            id="trading-style-hint"
            className="self-end pb-3 text-[11px] text-muted-dim"
          >
            {p.styleHint}
          </p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={action.pending || !isDirty}>
          {action.pending && (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          )}
          {action.pending ? p.saving : p.save}
        </Button>
      </div>
    </form>
  );
}
