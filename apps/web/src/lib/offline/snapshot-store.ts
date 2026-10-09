/**
 * A key/value store over IndexedDB, so cached reads survive a reload.
 *
 * POS and record keeping are read-mostly between sessions: a till needs its
 * catalog, its money policy and its org when the network is gone, and none of
 * that is safe to keep in `localStorage` (size, and it blocks the first paint).
 */

import Dexie, { Table } from "dexie";

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

interface CacheEntry {
  key: string;
  value: unknown;
  cachedAt: number;
}

class CacheDatabase extends Dexie {
  entries!: Table<CacheEntry, string>;

  constructor() {
    super("nomidat-cache");
    this.version(1).stores({
      entries: "key, cachedAt",
    });
  }
}

const db = new CacheDatabase();

function createIndexedDbSnapshotStore(): SnapshotStore {
  return {
    async read<T>(key: string) {
      const row = await db.entries.get(key);
      return row ? { value: row.value as T, cachedAt: row.cachedAt } : null;
    },
    async write<T>(key: string, value: T) {
      await db.entries.put({ key, value, cachedAt: Date.now() });
    },
    async clear() {
      await db.entries.clear();
    },
  };
}

/**
 * Memory fallback for private browsing, where IndexedDB may be blocked.
 * The session still works; it just does not survive a reload.
 */
function createMemorySnapshotStore(): SnapshotStore {
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
