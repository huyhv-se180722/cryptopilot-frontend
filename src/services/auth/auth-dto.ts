import type { AccountRole } from '../../types/domain';
import type { MessageResult } from './contracts';
import type { TokenPair } from './token-session';

/**
 * Runtime decoders for the backend auth contract (fe-guide modules/auth.md,
 * checked against `develop` @ 0d92def). Unknown input never becomes a typed
 * value without passing these checks.
 */
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(name + ' must be a non-empty string');
  return value;
}
function instant(value: unknown, name: string): string {
  const raw = text(value, name);
  if (Number.isNaN(Date.parse(raw)))
    throw new Error(name + ' must be ISO 8601');
  return raw;
}

const ROLES: Readonly<Record<string, AccountRole>> = {
  TRADER: 'Trader',
  ADMIN: 'Admin',
};

export interface DecodedSession {
  tokens: TokenPair;
  role: AccountRole;
}

/** `SessionResponse` of `/auth/login` and `/auth/refresh`. */
export function decodeSession(body: unknown): DecodedSession {
  const value = record(body);
  const role = ROLES[text(value.role, 'role')];
  if (!role) throw new Error('Unknown role');
  return {
    role,
    tokens: {
      accessToken: text(value.accessToken, 'accessToken'),
      accessTokenExpiresAt: instant(
        value.accessTokenExpiresAt,
        'accessTokenExpiresAt',
      ),
      refreshToken: text(value.refreshToken, 'refreshToken'),
      refreshTokenExpiresAt: instant(
        value.refreshTokenExpiresAt,
        'refreshTokenExpiresAt',
      ),
    },
  };
}

/** `MessageResponse` (`{ messageCode }`) of the account flows. */
export function decodeMessage(body: unknown): MessageResult {
  const messageCode = text(record(body).messageCode, 'messageCode');
  if (!/^MSG\d{2}$/.test(messageCode)) throw new Error('Invalid message id');
  return { messageCode };
}

/** The part of `ProfileResponse` (`GET /me/profile`) the session needs. */
export function decodeProfileIdentity(body: unknown): {
  email: string;
  displayName: string;
} {
  const value = record(body);
  return {
    email: text(value.email, 'email'),
    displayName: text(value.displayName, 'displayName'),
  };
}

/**
 * Reads the `sub` claim (account id) of an access token without verifying
 * it — the backend verifies every request; the client only needs the id.
 */
export function subjectOf(accessToken: string): string {
  const payload = accessToken.split('.')[1];
  if (!payload) throw new Error('Malformed token');
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return text(record(JSON.parse(json)).sub, 'sub');
}
