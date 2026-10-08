import { useCallback, useEffect, useState } from "react";

/**
 * Tracks whether the API is actually usable, not merely whether the device has
 * a network interface.
 *
 * `navigator.onLine` only reports link state, so a captive portal or a dead
 * upstream still reads "online". Trusting it meant a failed sale request threw
 * and the sale was lost instead of queued. We treat a failed request as offline
 * until a request succeeds again, which is the condition that actually matters
 * at a till.
 */
export function usePosOfflineStatus(onOnline?: () => void) {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // A failed call is the strongest possible evidence that the API is unreachable.
  const reportFailure = useCallback(() => setOffline(true), []);
  const reportSuccess = useCallback(() => {
    setOffline(false);
    onOnline?.();
  }, [onOnline]);

  return { offline, reportFailure, reportSuccess };
}
