import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema } from './schemas';
import { PASSWORD_PATTERN, passwordRuleResults } from './password-policy';

function issues(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [
      issue.path.join('.'),
      issue.message,
    ]),
  );
}

const validRegistration = {
  email: 'new.trader@example.test',
  displayName: 'New Trader',
  password: 'Abcdef12',
  confirmPassword: 'Abcdef12',
  acceptsDisclaimer: true,
};

describe('BR-02 password policy', () => {
  it('matches the server pattern at its boundaries', () => {
    expect(PASSWORD_PATTERN.test('Abcdef1')).toBe(false); // 7 chars
    expect(PASSWORD_PATTERN.test('Abcdefg1')).toBe(true); // 8 chars
    expect(PASSWORD_PATTERN.test('A1' + 'b'.repeat(62))).toBe(true); // 64
    expect(PASSWORD_PATTERN.test('A1' + 'b'.repeat(63))).toBe(false); // 65
    expect(PASSWORD_PATTERN.test('abcdefg1')).toBe(false);
    expect(PASSWORD_PATTERN.test('ABCDEFG1')).toBe(false);
    expect(PASSWORD_PATTERN.test('Abcdefgh')).toBe(false);
  });
  it('reports each rule for the live checklist', () => {
    expect(passwordRuleResults('abc1')).toEqual({
      length: false,
      lowercase: true,
      uppercase: false,
      digit: true,
    });
  });
});

describe('auth form schemas', () => {
  it('requires fields with MSG01 and email format with MSG02', () => {
    expect(
      issues(
        loginSchema.safeParse({ email: ' ', password: '', rememberMe: false }),
      ),
    ).toEqual({ email: 'MSG01', password: 'MSG01' });
    expect(
      issues(
        loginSchema.safeParse({
          email: 'not-an-email',
          password: 'x',
          rememberMe: false,
        }),
      ),
    ).toEqual({ email: 'MSG02' });
  });

  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
  });

  it('applies BR-02, the confirmation match and the disclaimer', () => {
    expect(
      issues(
        registerSchema.safeParse({
          ...validRegistration,
          password: 'weakpass',
          confirmPassword: 'other',
          acceptsDisclaimer: false,
        }),
      ),
    ).toMatchObject({ password: 'MSG03', acceptsDisclaimer: 'MSG01' });
    expect(
      issues(
        registerSchema.safeParse({
          ...validRegistration,
          confirmPassword: 'Abcdef13',
        }),
      ),
    ).toEqual({ confirmPassword: 'MSG03' });
  });

  it('limits the display name to 2–50 characters', () => {
    expect(
      issues(
        registerSchema.safeParse({ ...validRegistration, displayName: 'A' }),
      ),
    ).toEqual({ displayName: 'MSG01' });
    expect(
      registerSchema.safeParse({
        ...validRegistration,
        displayName: 'A'.repeat(50),
      }).success,
    ).toBe(true);
  });

  it('validates the reset form like registration', () => {
    expect(
      issues(
        resetPasswordSchema.safeParse({
          newPassword: 'Abcdef12',
          confirmPassword: 'Abcdef21',
        }),
      ),
    ).toEqual({ confirmPassword: 'MSG03' });
  });
});
