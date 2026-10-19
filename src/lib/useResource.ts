import { useCallback, useEffect, useState } from 'react';

interface Settled<T> {
  loader: () => Promise<T>;
  version: number;
  data?: T;
  error?: Error;
}

export interface Resource<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

/** Loads data when `loader` changes (memoize it with useCallback) and exposes a manual reload. */
export function useResource<T>(loader: () => Promise<T>): Resource<T> {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let active = true;
    loader().then(
      (data) => active && setSettled({ loader, version, data }),
      (error: unknown) =>
        active &&
        setSettled({ loader, version, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      active = false;
    };
  }, [loader, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loading = settled === null || settled.loader !== loader || settled.version !== version;
  return { data: settled?.data, error: loading ? undefined : settled.error, loading, reload };
}
