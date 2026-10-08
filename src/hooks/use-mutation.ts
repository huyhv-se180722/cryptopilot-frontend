import { useCallback, useEffect, useRef, useState } from 'react';

export type MutationState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown };

/**
 * One-shot write operation owned by a feature hook. Results arriving after
 * unmount or after a newer run are ignored; failures are kept, not thrown,
 * unless the caller awaits `run` and inspects the returned value.
 */
export function useMutation<TArgs extends unknown[], T>(
  operation: (...args: TArgs) => Promise<T>,
) {
  const [state, setState] = useState<MutationState<T>>({ status: 'idle' });
  const runId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: TArgs): Promise<MutationState<T>> => {
      const id = ++runId.current;
      setState({ status: 'pending' });
      let next: MutationState<T>;
      try {
        next = { status: 'success', data: await operation(...args) };
      } catch (error) {
        next = { status: 'error', error };
      }
      if (mounted.current && id === runId.current) setState(next);
      return next;
    },
    [operation],
  );
  const reset = useCallback(() => {
    runId.current++;
    setState({ status: 'idle' });
  }, []);
  return { state, run, reset, pending: state.status === 'pending' };
}
