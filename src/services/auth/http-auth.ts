import type { HttpClient } from '../api/http-client';
import type { Session } from '../../types/domain';
import type { AuthService } from './contracts';
import {
  decodeMessage,
  decodeProfileIdentity,
  decodeSession,
  subjectOf,
  type DecodedSession,
} from './auth-dto';
import type { TokenSession } from './token-session';

const AUTH = 'auth/';

/**
 * HTTP adapter for the backend auth module (`/api/v1/auth/*`, `/me/password`;
 * `/me/profile` for the signed-in identity).
 * Tokens stay in memory (`TokenSession`); a reload starts as a guest until
 * Q-44 settles where the refresh token may live in a browser.
 */
export function createHttpAuthService(
  http: HttpClient,
  tokens: TokenSession,
): AuthService {
  let current: Session | null = null;
  tokens.onEnded(() => {
    current = null;
  });

  const post = <T>(path: string, body: unknown, decode: (raw: unknown) => T) =>
    http.request({
      path: AUTH + path,
      method: 'POST',
      body,
      decode,
      anonymous: true,
    });

  async function openSession(
    decoded: DecodedSession,
    email: string,
  ): Promise<Session> {
    tokens.set(decoded.tokens);
    try {
      const id = subjectOf(decoded.tokens.accessToken);
      // `/me/profile` is Trader-only (403 for an Admin, SRS 3.1.3).
      const identity =
        decoded.role === 'Trader'
          ? await http.request({
              path: 'me/profile',
              decode: decodeProfileIdentity,
            })
          : { email, displayName: email };
      current = {
        user: { id, ...identity, role: decoded.role, status: 'active' },
        // No endpoint reports the plan yet (FEQ-02): gate nothing up front.
        entitlements: 'unknown',
      };
      return current;
    } catch (error) {
      tokens.clear();
      throw error;
    }
  }

  return {
    async restoreSession() {
      return tokens.hasTokens() ? current : null;
    },
    async login({ email, password, rememberMe }) {
      const decoded = await post(
        'login',
        { email: email.trim(), password, rememberMe },
        decodeSession,
      );
      return openSession(decoded, email.trim());
    },
    async logout() {
      const refreshToken = tokens.refreshToken();
      current = null;
      tokens.clear();
      if (refreshToken) await post('logout', { refreshToken }, () => undefined);
    },
    register: (request) => post('register', request, decodeMessage),
    verifyEmail: (token, signal) =>
      http.request({
        path: AUTH + 'verify-email',
        method: 'POST',
        body: { token },
        decode: decodeMessage,
        anonymous: true,
        ...(signal ? { signal } : {}),
      }),
    resendVerification: (email) =>
      post('resend-verification', { email }, decodeMessage),
    forgotPassword: (email) =>
      post('forgot-password', { email }, decodeMessage),
    async resetPassword(request) {
      const result = await post('reset-password', request, decodeMessage);
      // A reset revokes every session of the account (TECHNICAL_DESIGN 7.15).
      current = null;
      tokens.clear();
      return result;
    },
    changePassword: (request) =>
      http.request({
        path: 'me/password',
        method: 'PUT',
        body: request,
        decode: decodeMessage,
      }),
    onSessionEnded: (listener) => tokens.onEnded(listener),
  };
}

/** Renewal call used by `TokenSession` (`POST /auth/refresh`). */
export function createRefresher(http: () => HttpClient) {
  return async (refreshToken: string) =>
    (
      await http().request({
        path: AUTH + 'refresh',
        method: 'POST',
        body: { refreshToken },
        decode: decodeSession,
        anonymous: true,
      })
    ).tokens;
}
