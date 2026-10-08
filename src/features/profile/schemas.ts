import { z } from 'zod';
import { PASSWORD_PATTERN } from '../auth/password-policy';
import type { Copy } from '../../i18n/locales/en';
import { fieldErrorText, messageText } from '../../i18n/messages';
import type { ProfileUpdate, TradingStyle } from '../../types/domain';

/**
 * Client mirror of `PUT /me/profile` (fe-guide modules/user.md); issues are
 * SRS message ids and the server stays authoritative. Decimals are strings.
 */
const DECIMAL = /^\d+(\.\d+)?$/;
const fraction = (value: string) => value.split('.')[1]?.length ?? 0;

/** Bounds the MSG15 text names (backend `@Digits(20, 8)` for capital). */
export const RANGES = {
  defaultCapital: { min: '0.00000001', max: '99999999999999999999.99999999' },
  defaultRiskPercent: { min: '0.1', max: '10' },
} as const;

const optionalDecimal = (check: (value: string) => boolean) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (DECIMAL.test(value) && check(value)), {
      message: 'MSG15',
    });

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'MSG01')
    .min(2, 'MSG01')
    .max(50, 'MSG01'),
  defaultCapital: optionalDecimal(
    (value) =>
      Number(value) > 0 &&
      fraction(value) <= 8 &&
      (value.split('.')[0] ?? '').replace(/^0+(?=\d)/, '').length <= 20,
  ),
  defaultRiskPercent: optionalDecimal(
    (value) =>
      Number(value) >= 0.1 && Number(value) <= 10 && fraction(value) <= 3,
  ),
  tradingStyle: z.enum(['', 'SCALPING', 'DAY', 'SWING', 'POSITION']),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

/** Full replacement: an empty field is sent as null and cleared. */
export function toProfileUpdate(values: ProfileFormValues): ProfileUpdate {
  return {
    displayName: values.displayName.trim(),
    defaultCapital: values.defaultCapital.trim() || null,
    defaultRiskPercent: values.defaultRiskPercent.trim() || null,
    tradingStyle: (values.tradingStyle || null) as TradingStyle | null,
  };
}

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'MSG01'),
    newPassword: z.string().min(1, 'MSG01').regex(PASSWORD_PATTERN, 'MSG03'),
    confirmPassword: z.string().min(1, 'MSG01'),
  })
  .refine((form) => form.newPassword === form.confirmPassword, {
    path: ['confirmPassword'],
    message: 'MSG03',
  });
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

/** Field error text; MSG15 names the field's range. */
export function profileFieldError(
  copy: Copy,
  id: string | undefined,
  label: string,
  range?: { min: string; max: string },
): string | undefined {
  if (!id) return undefined;
  if (id === 'MSG15' && range)
    return messageText(copy, id, [], { field: label, ...range });
  return fieldErrorText(copy, id, label);
}
