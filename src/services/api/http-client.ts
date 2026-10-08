import { ServiceError } from './errors';
import { decodeProblem, type ApiProblem } from './problem';

export interface RequestOptions<T> {
  path: string;
  decode: (body: unknown) => T;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Readonly<Record<string, string>>;
  /** For sign-in style calls whose 401 means wrong credentials, not an ended session. */
  skipUnauthorizedHandler?: boolean;
}

/** No endpoint paths, auth scheme, retries, or response envelopes are invented here. */
export function createHttpClient(options: {
  baseUrl: string;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  onUnauthorized?: () => void;
}) {
  const fetcher = options.fetcher ?? fetch;
  return {
    async request<T>(request: RequestOptions<T>): Promise<T> {
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
      if (
        url.origin !== base.origin ||
        !url.pathname.startsWith(base.pathname)
      ) {
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
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeoutMs ?? 15_000);
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
            ...request.headers,
          },
          ...(request.body === undefined
            ? {}
            : { body: JSON.stringify(request.body) }),
        });
        if (!response.ok) {
          if (response.status === 401 && !request.skipUnauthorizedHandler)
            options.onUnauthorized?.();
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
        if (timedOut)
          throw new ServiceError('The request timed out.', 'TIMEOUT');
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
    },
  };
}
export type HttpClient = ReturnType<typeof createHttpClient>;
