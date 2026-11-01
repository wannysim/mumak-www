import { useCallback, useEffect, useRef, useState } from 'react';

import { OperationsError, type OperationsErrorKind } from '@/lib/operations-client';

type QueryState<T> = {
  identity: string;
  status: 'idle' | 'loading' | 'ready' | 'error' | 'paused';
  data: T | null;
  fetchedAt: string | null;
  error: OperationsErrorKind | null;
};
function useOperationsQuery<T>(identity: string, load: ((signal: AbortSignal) => Promise<T>) | null) {
  const [state, setState] = useState<QueryState<T>>({
    identity,
    status: 'idle',
    data: null,
    fetchedAt: null,
    error: null,
  });
  const generation = useRef(0);
  const active = useRef<AbortController | null>(null);
  const retry = useCallback(async () => {
    if (!load || document.visibilityState !== 'visible') return;
    active.current?.abort();
    const abort = new AbortController();
    active.current = abort;
    const current = ++generation.current;
    setState(previous => ({
      identity,
      status: 'loading',
      data: previous.identity === identity ? previous.data : null,
      fetchedAt: previous.identity === identity ? previous.fetchedAt : null,
      error: null,
    }));
    try {
      const data = await load(abort.signal);
      if (current === generation.current && !abort.signal.aborted)
        setState({ identity, status: 'ready', data, fetchedAt: new Date().toISOString(), error: null });
    } catch (error) {
      if (current === generation.current && !abort.signal.aborted)
        setState(previous => ({
          identity,
          status: 'error',
          data: null,
          fetchedAt: previous.fetchedAt,
          error: error instanceof OperationsError ? error.kind : 'transport',
        }));
    }
  }, [identity, load]);
  const stop = useCallback(() => {
    generation.current++;
    active.current?.abort();
  }, []);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === 'visible') void retry();
      else {
        active.current?.abort();
        generation.current++;
        setState(previous => ({ ...previous, status: 'paused' }));
      }
    };
    visibility();
    const timer = window.setInterval(() => {
      void retry();
    }, 60_000);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [retry, stop]);
  return {
    ...(state.identity === identity
      ? state
      : { identity, status: 'idle' as const, data: null, fetchedAt: null, error: null }),
    retry,
  };
}
export { useOperationsQuery, type QueryState };
