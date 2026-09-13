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
