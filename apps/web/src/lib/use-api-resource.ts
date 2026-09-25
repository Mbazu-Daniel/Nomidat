import { useEffect, useState } from "react";
import { createApiRequest } from "./api";

/** Loads a resource again when its URL or revision changes; ignores stale responses. */
export function useApiResource<T>(path: string, initial: T, revision = 0) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void createApiRequest<T>(path)
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
  }, [path, revision]);
  return { data, setData, loading, error, setError };
}
