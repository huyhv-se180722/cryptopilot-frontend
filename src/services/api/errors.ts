import type { ApiProblem } from './problem';

export type ErrorCode =
  | 'NOT_CONFIGURED'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'UNSUPPORTED_OPERATION';

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status?: number,
    /** Decoded backend problem detail, when the response carried one. */
    public readonly problem?: ApiProblem,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function integrationPending(): never {
  throw new ServiceError(
    'Backend integration is not configured for this operation.',
    'NOT_CONFIGURED',
  );
}

/** Problem detail carried by an error, if any. */
export function problemOf(error: unknown): ApiProblem | undefined {
  return error instanceof ServiceError ? error.problem : undefined;
}
