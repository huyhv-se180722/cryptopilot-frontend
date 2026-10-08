import type { AuthService } from '../services/auth/contracts';
import { ServiceError } from '../services/api/errors';
import type { ApiProblem } from '../services/api/problem';
import type { Session } from '../types/domain';
import {
  DEV_PASSWORD,
  DEV_TOKENS,
  devBlockedAccounts,
  devPrincipals,
} from './fixtures/auth';

/**
 * DEVELOPMENT ONLY (ADR-010). In-memory auth adapter shaped like the backend
 * contract: same messages, same refusals. A reload signs out. It accepts only
 * the documented development principals and password.
 */
function refuse(
  status: number,
  code: string,
  messageCode: string,
  extra: Partial<Pick<ApiProblem, 'messageArgs' | 'fieldErrors'>> = {},
): never {
  throw new ServiceError('Development auth refusal.', 'HTTP_ERROR', status, {
    status,
    code,
    messageCode,
    messageArgs: extra.messageArgs ?? [],
    fieldErrors: extra.fieldErrors ?? {},
  });
}

function pause(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 350);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

const LOCK_AFTER = 5;
const LOCK_MINUTES = '15';

export function createDevelopmentAuth(): AuthService {
  let current: Session | null = null;
  const registered = new Set<string>();
  const failures = new Map<string, number>();
  const known = (email: string) =>
    devPrincipals.some((p) => p.user.email === email) ||
    email in devBlockedAccounts ||
    registered.has(email);

  return {
    async restoreSession(signal) {
      await pause(signal);
      return current;
    },
    async login({ email, password }) {
      await pause();
      const key = email.trim().toLowerCase();
      if ((failures.get(key) ?? 0) >= LOCK_AFTER)
        refuse(429, 'LOGIN_TEMPORARILY_LOCKED', 'MSG09', {
          messageArgs: [LOCK_MINUTES],
        });
      const account = devPrincipals.find((p) => p.user.email === key);
      const blocked = devBlockedAccounts[key];
      if (password !== DEV_PASSWORD || (!account && !blocked)) {
        failures.set(key, (failures.get(key) ?? 0) + 1);
        refuse(401, 'INVALID_CREDENTIALS', 'MSG08');
      }
      failures.delete(key);
      if (blocked === 'UNVERIFIED') refuse(403, 'EMAIL_NOT_VERIFIED', 'MSG11');
      if (blocked)
        refuse(403, 'ACCOUNT_NOT_ACTIVE', 'MSG10', { messageArgs: [blocked] });
      current = account ?? null;
      if (!current) refuse(401, 'INVALID_CREDENTIALS', 'MSG08');
      return current;
    },
    async register({ email }) {
      await pause();
      const key = email.trim().toLowerCase();
      if (known(key))
        refuse(409, 'EMAIL_ALREADY_REGISTERED', 'MSG04', {
          fieldErrors: { email: 'MSG04' },
        });
      registered.add(key);
      return { messageCode: 'MSG05' };
    },
    async verifyEmail(token, signal) {
      await pause(signal);
      if (token === DEV_TOKENS.valid) return { messageCode: 'MSG06' };
      if (token === DEV_TOKENS.alreadyVerified)
        refuse(409, 'EMAIL_ALREADY_VERIFIED', 'MSG07');
      return refuse(400, 'TOKEN_INVALID_OR_EXPIRED', 'MSG07');
    },
    async resendVerification() {
      await pause();
      return { messageCode: 'MSG05' };
    },
    async forgotPassword() {
      await pause();
      return { messageCode: 'MSG12' };
    },
    async resetPassword({ token }) {
      await pause();
      if (token !== DEV_TOKENS.valid)
        refuse(400, 'TOKEN_INVALID_OR_EXPIRED', 'MSG07');
      current = null;
      return { messageCode: 'MSG13' };
    },
    async logout() {
      current = null;
    },
  };
}
