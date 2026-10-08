/* eslint-env serviceworker */
// fallow-ignore-file unused-file -- registered at runtime by register-service-worker.ts via navigator.serviceWorker.register("/sw.js"); nothing imports it by URL.
/**
 * Makes the POS survive a dead network.
 *
 * Three caches, because the three kinds of request have different rules:
 *  - SHELL  hashed assets and icons. Cache-first: a content-hashed asset can
 *           never go stale, so this needs no revalidation.
 *  - DATA   API reads. Network-first, falling back to the last good response so a
 *           till opened offline still shows its catalog and contacts.
 *  - QUEUE  the IndexedDB sale queue is owned by the app, not by us. The worker
 *           never touches it.
 *
 * Navigations are not cached or intercepted: the document is server-rendered per
 * tenant and carries the session, so a stale copy could show the wrong shop.
 *
 * API writes are deliberately NOT handled. A write that fails must surface as a
 * failure so the app can queue it; silently "succeeding" a POST would lose a sale.
 */

const VERSION = "v1";
const SHELL_CACHE = `nomidat-shell-${VERSION}`;
const DATA_CACHE = `nomidat-data-${VERSION}`;

// API_PREFIX matches the app's own base so worker and client agree.
const API_PREFIX = "/api/";

self.addEventListener("install", (event) => {
  // Nothing is pre-cached. The document is server-rendered and per-tenant, so
  // caching it at install time would either 404 or pin a stranger's session.
  // The POS warms its own cache on first load instead.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, DATA_CACHE]);
      for (const name of await caches.keys()) {
        if (!keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

/** Cache-first, then network — the response is stored so the next miss is offline-safe. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

/** Network-first, falling back to the last good response. */
async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (reason) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw reason;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation is network-first with no fallback: the document is rendered per
  // tenant and carries the session, so serving a stale one could show the wrong
  // shop. Assets and API reads below are what make the POS usable offline.
  if (request.mode === "navigate") return;

  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

/** Lets the page force an update after a deploy without a hard reload dance. */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") void self.skipWaiting();
});
