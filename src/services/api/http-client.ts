import { ServiceError } from './errors';
import { decodeProblem, type ApiProblem } from './problem';

export interface RequestOptions<T> {
  path: string;
  decode: (body: unknown) => T;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Readonly<Record<string, string>>;
  /**
   * Public auth calls (sign-in, refresh, logout, registration flows): no
   * bearer token and no session handling, because their 401 means wrong
   * credentials or a dead refresh token, not an expired access token.
   */
  anonymous?: boolean;
  /**
   * This request's own time limit, for the few calls the server answers
   * slowly by design (a feed read, an AI summary); the client's otherwise.
   */
  timeoutMs?: number;
}

/** Bearer token source with single-flight renewal (services/auth). */
export interface SessionCredentials {
  accessToken(): string | null;
  refresh(): Promise<'renewed' | 'ended' | 'unavailable'>;
}

/** No endpoint paths, auth scheme, retries, or response envelopes are invented here. */
export function createHttpClient(options: {
  baseUrl: string;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  /** Called when a protected call is refused and the session cannot be renewed. */
  onUnauthorized?: () => void;
  session?: SessionCredentials;
}) {
  const fetcher = options.fetcher ?? fetch;

  async function attempt<T>(
    request: RequestOptions<T>,
    token: string | null,
  ): Promise<T> {
    if (!options.baseUrl) {
      throw new ServiceError(
        'API base URL is not configured.',
        'NOT_CONFIGURED',
      );
    }
    const base = new URL(
      options.baseUrl.endsWith('/') ? options.baseUrl : options.baseUrl + '/',
    );
    const url = new URL(request.path.replace(/^\/+/, ''), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new ServiceError(
        'API path must stay within the configured base URL.',
        'NOT_CONFIGURED',
      );
    }
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener('abort', abort, { once: true });
    if (request.signal?.aborted) abort();
    const timer = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
      },
      request.timeoutMs ?? options.timeoutMs ?? 15_000,
    );
    try {
      const response = await fetcher(url, {
        method: request.method ?? 'GET',
        credentials: options.credentials ?? 'same-origin',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(request.body === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...request.headers,
        },
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
      });
      if (!response.ok) {
        // Only whitelisted problem fields are kept; raw bodies, titles and
        // details never reach the UI.
        let problem: ApiProblem | undefined;
        try {
          problem = decodeProblem(await response.json(), response.status);
        } catch {
          problem = undefined;
        }
        throw new ServiceError(
          'The request could not be completed.',
          'HTTP_ERROR',
          response.status,
          problem,
        );
      }
      const body: unknown =
        response.status === 204 ? undefined : await response.json();
      try {
        return request.decode(body);
      } catch {
        throw new ServiceError(
          'The server returned an unexpected response.',
          'INVALID_RESPONSE',
        );
      }
    } catch (error) {
      if (request.signal?.aborted) throw request.signal.reason ?? error;
      if (timedOut) throw new ServiceError('The request timed out.', 'TIMEOUT');
      if (error instanceof ServiceError) throw error;
      if (error instanceof SyntaxError)
        throw new ServiceError(
          'The server returned invalid JSON.',
          'INVALID_RESPONSE',
        );
      throw new ServiceError('Unable to reach the server.', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', abort);
    }
  }

  const isUnauthorized = (error: unknown) =>
    error instanceof ServiceError && error.status === 401;

  return {
    /**
     * Sends the request with the current access token. On a 401 the session
     * is renewed once (single-flight) and the request replayed once; if the
     * session cannot be renewed, `onUnauthorized` reports it (MSG44).
     */
    async request<T>(request: RequestOptions<T>): Promise<T> {
      if (request.anonymous) return attempt(request, null);
      const session = options.session;
      try {
        return await attempt(request, session?.accessToken() ?? null);
      } catch (error) {
        if (!isUnauthorized(error)) throw error;
        const outcome = session ? await session.refresh() : 'ended';
        if (outcome === 'unavailable') throw error;
        if (outcome === 'renewed') {
          try {
            return await attempt(request, session?.accessToken() ?? null);
          } catch (retryError) {
            if (isUnauthorized(retryError)) options.onUnauthorized?.();
            throw retryError;
          }
        }
        options.onUnauthorized?.();
        throw error;
      }
    },
  };
}
export type HttpClient = ReturnType<typeof createHttpClient>;
