import { useCallback, useEffect, useRef, useState } from 'react';

export type QueryState<T> = {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  refresh: () => void;
};

type Settled<T> = { request: string; data: T | undefined; error: Error | undefined };

/**
 * Runs an async read and re-runs it when `key` changes or `subscribe` fires.
 * Results from superseded runs are dropped, so a slow search can never
 * overwrite the results of a newer one. Previous data stays visible while
 * the next read is in flight, which keeps lists from flashing empty.
 */
export function useQuery<T>(
  key: string,
  read: () => Promise<T>,
  subscribe?: (onChange: () => void) => () => void,
): QueryState<T> {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({
    request: '',
    data: undefined,
    error: undefined,
  });
  const readRef = useRef(read);
  const request = `${version}:${key}`;

  useEffect(() => {
    readRef.current = read;
  });

  useEffect(() => {
    let current = true;
    readRef.current().then(
      (data) => current && setSettled({ request, data, error: undefined }),
      (error: unknown) =>
        current &&
        setSettled((s) => ({
          request,
          data: s.data,
          error: error instanceof Error ? error : new Error(String(error)),
        })),
    );
    return () => {
      current = false;
    };
  }, [request]);

  useEffect(() => subscribe?.(() => setVersion((v) => v + 1)), [subscribe]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: settled.data,
    error: settled.error,
    loading: settled.request !== request,
    refresh,
  };
}
