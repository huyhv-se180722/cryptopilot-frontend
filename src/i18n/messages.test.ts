import { describe, expect, it } from 'vitest';
import { resolveCopy } from './copy';
import { errorText, fieldErrorText, messageText } from './messages';
import { ServiceError } from '../services/api/errors';
import { decodeProblem } from '../services/api/problem';

const copy = resolveCopy('en');

function httpError(body: unknown, status: number) {
  return new ServiceError(
    'x',
    'HTTP_ERROR',
    status,
    decodeProblem(body, status),
  );
}

describe('messageText', () => {
  it('fills positional backend arguments in placeholder order', () => {
    expect(messageText(copy, 'MSG27', ['5', 'watchlist items', 'FREE'])).toBe(
      'You have reached the limit of 5 watchlist items of the FREE plan. Upgrade to increase the limit?',
    );
  });
  it('lets named values override positional ones', () => {
    expect(messageText(copy, 'MSG05', [], { email: 'a@b.test' })).toBe(
      'Account created. Please check a@b.test to verify your account.',
    );
  });
  it('falls back to MSG43 for unknown ids', () => {
    expect(messageText(copy, 'MSG99')).toBe(
      'Something went wrong. Please try again. (Ref: —)',
    );
  });
  it('labels field errors', () => {
    expect(fieldErrorText(copy, 'MSG01', 'Display name')).toBe(
      'The display name field is required.',
    );
  });
});

describe('errorText', () => {
  it('shows the SRS message of a problem with its arguments', () => {
    expect(
      errorText(
        copy,
        httpError(
          {
            code: 'LOGIN_TEMPORARILY_LOCKED',
            messageCode: 'MSG09',
            messageArgs: ['12'],
            detail: 'internal text that must never show',
          },
          429,
        ),
      ),
    ).toBe('Too many failed attempts. Please try again after 12 minutes.');
  });
  it('never shows a placeholder the problem leaves unfilled', () => {
    expect(
      errorText(
        copy,
        httpError(
          { code: 'VALIDATION_FAILED', messageCode: 'MSG01', messageArgs: [] },
          400,
        ),
      ),
    ).toBe(
      'The server could not accept this request: a value is missing or not valid.',
    );
  });

  it('maps account status arguments to words', () => {
    expect(
      errorText(
        copy,
        httpError(
          {
            code: 'ACCOUNT_NOT_ACTIVE',
            messageCode: 'MSG10',
            messageArgs: ['BANNED'],
          },
          403,
        ),
      ),
    ).toBe('Your account has been banned. Please contact support.');
  });
  it('puts the trace id into MSG43', () => {
    expect(
      errorText(
        copy,
        httpError(
          { code: 'INTERNAL_ERROR', messageCode: 'MSG43', traceId: 'abc-123' },
          500,
        ),
      ),
    ).toBe('Something went wrong. Please try again. (Ref: abc-123)');
  });
  it('explains rate limiting with the wait time', () => {
    expect(
      errorText(
        copy,
        httpError(
          { code: 'RATE_LIMITED', messageCode: 'MSG50', messageArgs: ['30'] },
          429,
        ),
      ),
    ).toBe('Too many requests. Please wait 30 seconds and try again.');
  });
  it('covers transport failures without a problem body', () => {
    expect(errorText(copy, new ServiceError('x', 'NOT_CONFIGURED'))).toBe(
      copy.errors.notConfigured,
    );
    expect(errorText(copy, new ServiceError('x', 'NETWORK_ERROR'))).toBe(
      copy.errors.network,
    );
    expect(errorText(copy, new Error('boom'))).toContain('(Ref: —)');
  });
});

describe('decodeProblem', () => {
  it('rejects bodies without a stable code and message id', () => {
    expect(decodeProblem({ title: 'Bad Request' }, 400)).toBeUndefined();
    expect(decodeProblem('oops', 500)).toBeUndefined();
    expect(
      decodeProblem({ code: 'X', messageCode: 'hello' }, 400),
    ).toBeUndefined();
  });
  it('keeps field message ids and turns binding notes into MSG01', () => {
    const problem = decodeProblem(
      {
        code: 'VALIDATION_FAILED',
        messageCode: 'MSG01',
        errors: {
          email: 'MSG02',
          confirmPasswordMatching: 'MSG03',
          body: 'is not readable',
        },
      },
      400,
    );
    expect(problem?.fieldErrors).toEqual({
      email: 'MSG02',
      confirmPasswordMatching: 'MSG03',
      body: 'MSG01',
    });
  });
});
