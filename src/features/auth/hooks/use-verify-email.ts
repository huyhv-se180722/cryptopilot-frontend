import { useEffect, useRef, useState } from 'react';
import { useServices } from '../../../hooks/use-services';

export type VerifyState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'error'; error: unknown };

/**
 * Verifies the emailed token exactly once: the token is single-use, so the
 * StrictMode effect replay must not send it twice. Every effect run listens
 * to the same request instead.
 */
export function useVerifyEmail(token: string | null) {
  const { auth } = useServices();
  const request = useRef<{ token: string; promise: Promise<unknown> } | null>(
    null,
  );
  const [state, setState] = useState<VerifyState>(
    token ? { status: 'pending' } : { status: 'idle' },
  );
  useEffect(() => {
    if (!token) return;
    if (request.current?.token !== token)
      request.current = { token, promise: auth.verifyEmail(token) };
    let active = true;
    request.current.promise.then(
      () => {
        if (active) setState({ status: 'success' });
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [auth, token]);
  return state;
}
