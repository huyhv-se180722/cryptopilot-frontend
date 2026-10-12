import { ServiceError } from '../api/errors';

/** Tokens of one sign-in, as the backend issues them (TECHNICAL_DESIGN 7.15). */
export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export type RefreshOutcome = 'renewed' | 'ended' | 'unavailable';

interface Timers {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const browserTimers: Timers = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) =>
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Renew about a minute before the access token expires, not after a 401. */
export const REFRESH_LEAD_MS = 60_000;

/**
 * Holds the tokens of the current session in memory only (Q-44: no storage
 * until the backend offers an HttpOnly cookie). Refresh is single-flight:
 * presenting a refresh token twice makes the server revoke the session.
 */
export class TokenSession {
  private tokens: TokenPair | null = null;
  private refreshing: Promise<RefreshOutcome> | null = null;
  private timer: unknown;
  private readonly endedListeners = new Set<() => void>();

  constructor(
    private readonly renew: (refreshToken: string) => Promise<TokenPair>,
    private readonly timers: Timers = browserTimers,
  ) {}

  accessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  refreshToken(): string | null {
    return this.tokens?.refreshToken ?? null;
  }

  hasTokens(): boolean {
    return this.tokens !== null;
  }

  /** Store a new pair (sign-in or rotation) and schedule the next renewal. */
  set(pair: TokenPair): void {
    this.tokens = pair;
    this.schedule();
  }

  /**
   * One refresh at a time; concurrent callers share the same outcome.
   * A refused refresh ends the session; a network failure keeps it.
   */
  refresh(): Promise<RefreshOutcome> {
    const current = this.tokens;
    if (!current) return Promise.resolve('ended');
    this.refreshing ??= this.renew(current.refreshToken)
      .then(
        (pair): RefreshOutcome => {
          this.set(pair);
          return 'renewed';
        },
        (error: unknown): RefreshOutcome => {
          if (error instanceof ServiceError && error.code === 'HTTP_ERROR') {
            this.end();
            return 'ended';
          }
          return 'unavailable';
        },
      )
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  /** Local sign-out: forget the tokens without reporting an expiry. */
  clear(): void {
    this.tokens = null;
    this.cancelTimer();
  }

  /** The server no longer accepts this session (MSG44). */
  end(): void {
    const hadTokens = this.tokens !== null;
    this.clear();
    if (hadTokens) this.endedListeners.forEach((listener) => listener());
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }

  private schedule(): void {
    this.cancelTimer();
    if (!this.tokens) return;
    const expiresAt = Date.parse(this.tokens.accessTokenExpiresAt);
    if (Number.isNaN(expiresAt)) return;
    const delay = Math.max(0, expiresAt - this.timers.now() - REFRESH_LEAD_MS);
    this.timer = this.timers.setTimeout(() => void this.refresh(), delay);
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) this.timers.clearTimeout(this.timer);
    this.timer = undefined;
  }
}
