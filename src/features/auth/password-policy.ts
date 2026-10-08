/**
 * BR-02 password policy: 8–64 characters with a lowercase letter, an
 * uppercase letter and a digit. Same pattern the server enforces.
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

export type PasswordRule = 'length' | 'lowercase' | 'uppercase' | 'digit';

export const PASSWORD_RULES: readonly PasswordRule[] = [
  'length',
  'lowercase',
  'uppercase',
  'digit',
];

export function passwordRuleResults(
  password: string,
): Record<PasswordRule, boolean> {
  return {
    length: password.length >= 8 && password.length <= 64,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
}
