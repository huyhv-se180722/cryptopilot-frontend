/**
 * What a tab keeps to sign the Trader in again after a reload (D-102,
 * ADR-021): the refresh token, its expiry and the signed-in email (an
 * Admin has no profile endpoint to read it back). The access token is
 * never stored.
 */
export interface SavedSession {
  refreshToken: string;
  refreshTokenExpiresAt: string;
  email: string;
}

export interface SessionStore {
  read(): SavedSession | null;
  /** On sign-in and on every rotation. */
  saveTokens(refreshToken: string, refreshTokenExpiresAt: string): void;
  saveEmail(email: string): void;
  clear(): void;
}

/** Keeps nothing: the session lasts as long as the page (tests, no storage). */
export const memorySessionStore: SessionStore = {
  read: () => null,
  saveTokens: () => undefined,
  saveEmail: () => undefined,
  clear: () => undefined,
};

const KEY = 'cp-session';

function isSaved(value: unknown): value is SavedSession {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.refreshToken === 'string' &&
    record.refreshToken !== '' &&
    typeof record.refreshTokenExpiresAt === 'string' &&
    typeof record.email === 'string'
  );
}

/**
 * The tab's `sessionStorage`, never `localStorage` (D-102). Storage that
 * throws (private window, blocked site data) keeps nothing, so the session
 * then lasts as long as the page, as before.
 */
export function browserSessionStore(
  storage: () => Storage = () => window.sessionStorage,
): SessionStore {
  const read = (): SavedSession | null => {
    try {
      const raw = storage().getItem(KEY);
      const value: unknown = raw ? JSON.parse(raw) : null;
      return isSaved(value) ? value : null;
    } catch {
      return null;
    }
  };
  const write = (patch: Partial<SavedSession>) => {
    try {
      const next = { email: '', ...read(), ...patch };
      if (isSaved(next)) storage().setItem(KEY, JSON.stringify(next));
    } catch {
      // Not kept; the session still works until the page closes.
    }
  };
  return {
    read,
    saveTokens: (refreshToken, refreshTokenExpiresAt) =>
      write({ refreshToken, refreshTokenExpiresAt }),
    saveEmail: (email) => write({ email }),
    clear: () => {
      try {
        storage().removeItem(KEY);
      } catch {
        // Nothing kept.
      }
    },
  };
}
