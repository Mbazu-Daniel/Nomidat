/**
 * Registers the offline worker.
 *
 * Only in a production build: in dev the worker would serve stale bundles and
 * hide the change you just made. Skipped where the browser has no service worker
 * support, which must never break the page.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  const register = () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // No worker means no offline, but the app still works online. The user
      // cannot act on this, so failing quietly is correct.
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

export type StorageDurability =
  /** Granted. The browser will not evict this origin under storage pressure. */
  | "persistent"
  /** Refused, but data still works — it is merely evictable. */
  | "best-effort"
  /** IndexedDB is unavailable. A queued sale cannot be trusted to survive. */
  | "unavailable";

/**
 * Asks the browser to exempt this origin from storage eviction.
 *
 * Without this, Safari deletes an origin's script-created data after seven days
 * without user interaction, and every browser evicts the least-recently-used
 * origin under storage pressure. A till that sits closed over a weekend is
 * exactly that origin — it would come back to a silently empty queue, with
 * unpaid sales and no error. `persist()` is the only thing that prevents it.
 *
 * A refusal is normal on Chrome rather than a bug, which is why the caller warns
 * the seller instead of shrugging.
 */
export async function requestDurableStorage(): Promise<StorageDurability> {
  if (typeof indexedDB === "undefined") return "unavailable";
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "best-effort";
  try {
    return (await navigator.storage.persist()) ? "persistent" : "best-effort";
  } catch {
    return "best-effort";
  }
}

/** Reads the current grant without prompting, for display on a later visit. */
export async function isStoragePersistent(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
