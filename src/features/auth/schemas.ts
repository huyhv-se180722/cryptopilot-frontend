import { z } from 'zod';
import { PASSWORD_PATTERN } from './password-policy';

/**
 * Client-side mirror of the backend auth validation (SRS 3.2, BR-02).
 * Issue messages are SRS message ids; the form renders them through the
 * MSG catalog with the field label. The server stays authoritative.
 */
const required = (schema: z.ZodString) => schema.trim().min(1, 'MSG01');

const email = required(z.string()).max(255, 'MSG02').pipe(z.email('MSG02'));

const password = required(z.string()).regex(PASSWORD_PATTERN, 'MSG03');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'MSG01'),
  rememberMe: z.boolean(),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email,
    displayName: required(z.string()).min(2, 'MSG01').max(50, 'MSG01'),
    password,
    confirmPassword: z.string().min(1, 'MSG01'),
    acceptsDisclaimer: z.boolean().refine((value) => value, 'MSG01'),
  })
  .refine((form) => form.password === form.confirmPassword, {
    path: ['confirmPassword'],
    message: 'MSG03',
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const emailSchema = z.object({ email });
export type EmailForm = z.infer<typeof emailSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string().min(1, 'MSG01'),
  })
  .refine((form) => form.newPassword === form.confirmPassword, {
    path: ['confirmPassword'],
    message: 'MSG03',
  });
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

/**
 * Backend field-error keys that are not form fields (03-conventions):
 * the confirmation mismatch shows under the confirm field.
 */
export const SERVER_FIELD_ALIASES: Readonly<Record<string, string>> = {
  confirmPasswordMatching: 'confirmPassword',
};

/** SCR-07 Security tab (UC-07): same BR-02 rule and MSG03 mismatch. */
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
