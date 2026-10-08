import { useCallback, useEffect, useRef, useState } from "react";
import { createApiRequest } from "./api";

/**
 * Reads and writes against the API, so a panel describes what it wants rather
 * than how to fetch it.
 *
 * Two things every panel was re-implementing: cancelling a request when its inputs
 * change before it lands, and turning a refusal into a sentence. Both are subtle,
 * both were written out twenty-four times, and neither is visible in a panel's
 * markup — so a race fixed in one panel stayed broken in the other twenty-three.
 */

/**
 * Runs `load` whenever `deps` change, and never lets a stale answer land.
 *
 * `enabled: false` renders the initial value and fetches nothing, which is what a
 * panel wants before it knows what to ask for. Setting it back to true loads.
 */
export function useLoadedResource<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  initial: T,
  enabled = true,
) {
  const initialValue = useRef(initial);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setData(initialValue.current);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void load()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return { data, setData, loading, error, setError };
}

/** One URL, fetched when the URL or the revision changes. `null` fetches nothing. */
export function useApiResource<T>(path: string | null, initial: T, revision = 0) {
  return useLoadedResource(
    () => createApiRequest<T>(path as string),
    [path, revision],
    initial,
    path !== null,
  );
}

/** One fetcher, re-run when its key or the revision changes. `null` fetches nothing. */
export function useAsyncResource<T>(
  load: (key: string) => Promise<T>,
  key: string | null,
  initial: T,
  revision = 0,
) {
  return useLoadedResource(
    () => load(key as string),
    [key, revision, load],
    initial,
    key !== null,
  );
}

/**
 * Runs a write and reports what happened, so a form does not hand-roll the same
 * four lines around every submit.
 *
 * Returns whether it succeeded, so a caller that has follow-up work — navigate,
 * close, refresh — can skip it when the write was refused. The refusal is already
 * in `error`, which the caller renders; nothing is re-thrown at the caller to
 * catch.
 */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = useCallback(async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, setBusy, submit };
}

/** The sentence a refusal should show, whatever shape the failure arrived in. */
export function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}