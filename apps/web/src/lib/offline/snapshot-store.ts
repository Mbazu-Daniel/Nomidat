/**
 * A key/value store over IndexedDB, so cached reads survive a reload.
 *
 * POS and record keeping are read-mostly between sessions: a till needs its
 * catalog, its money policy and its org when the network is gone, and none of
 * that is safe to keep in `localStorage` (size, and it blocks the first paint).
 */

const DB_NAME = "nomidat-cache";
const DB_VERSION = 1;
const STORE = "entries";

export interface CachedSnapshot<T> {
  value: T;
  cachedAt: number;
}

/** Storage seam so caching can be exercised without a browser IndexedDB. */
export interface SnapshotStore {
  read<T>(key: string): Promise<CachedSnapshot<T> | null>;
  write<T>(key: string, value: T): Promise<void>;
  clear(): Promise<void>;
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "key" });
      }
    };
  });
}

export function createIndexedDbSnapshotStore(): SnapshotStore {
  return {
    async read<T>(key: string) {
      const row = await withStore<CachedSnapshot<T> & { key: string }>("readonly", (store) =>
        store.get(key),
      );
      return row ? { value: row.value, cachedAt: row.cachedAt } : null;
    },
    async write<T>(key: string, value: T) {
      await withStore("readwrite", (store) => store.put({ key, value, cachedAt: Date.now() }));
    },
    async clear() {
      await withStore("readwrite", (store) => store.clear());
    },
  };
}

/**
 * Memory fallback for private browsing, where IndexedDB may be blocked.
 * The session still works; it just does not survive a reload.
 */
export function createMemorySnapshotStore(): SnapshotStore {
  const rows = new Map<string, CachedSnapshot<unknown>>();
  return {
    async read<T>(key: string) {
      return (rows.get(key) as CachedSnapshot<T> | undefined) ?? null;
    },
    async write<T>(key: string, value: T) {
      rows.set(key, { value, cachedAt: Date.now() });
    },
    async clear() {
      rows.clear();
    },
  };
}
let store: SnapshotStore | null = null;

export function snapshotStore(): SnapshotStore {
  if (store) return store;
  try {
    store =
      typeof indexedDB === "undefined"
        ? createMemorySnapshotStore()
        : createIndexedDbSnapshotStore();
  } catch {
    store = createMemorySnapshotStore();
  }
  return store;
}

/** Reads through the network, falling back to the last good value when it fails. */
export async function readThrough<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const value = await load();
    await snapshotStore().write(key, value);
    return value;
  } catch (reason) {
    const cached = await snapshotStore().read<T>(key);
    if (cached) return cached.value;
    throw reason;
  }
}
