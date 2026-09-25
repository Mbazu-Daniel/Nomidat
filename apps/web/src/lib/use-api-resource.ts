import { useEffect, useState, useRef } from "react";
import { createApiRequest } from "./api";

/** Loads a resource again when its URL or revision changes; ignores stale responses. */
export function useApiResource<T>(path: string | null, initial: T, revision = 0) {
  return useAsyncResource(createApiRequest<T>, path, initial, revision);
}
function useAsyncResource<T>(
  load: (key: string) => Promise<T>,
  key: string | null,
  initial: T,
  revision = 0,
) {
  const initialValue = useRef(initial);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (key === null) {
      setData(initialValue.current);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void load(key)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, revision, load]);
  return { data, setData, loading, error, setError };
}
