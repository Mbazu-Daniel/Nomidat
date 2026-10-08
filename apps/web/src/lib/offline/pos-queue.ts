export interface PosCatalogSnapshot {
  products: unknown[];
  contacts: unknown[];
  cachedAt: number;
}

export interface QueuedPosSale {
  id: string;
  organizationId: string;
  payload: unknown;
  createdAt: number;
}

const DB_NAME = "nomidat-pos";
const DB_VERSION = 1;

/** Storage seam so the queue can be exercised without a browser IndexedDB. */
export interface PosQueueStore {
  readAll(organizationId: string): Promise<QueuedPosSale[]>;
  put(entry: QueuedPosSale): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_STORE = "queue";

export function createIndexedDbQueueStore(
  openDatabase: IDBFactory["open"] = indexedDB.open.bind(indexedDB),
): PosQueueStore {
  async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = openDatabase(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) {
          request.result.createObjectStore(DB_STORE, { keyPath: "id" });
        }
      };
    });

    const transaction = db.transaction(DB_STORE, mode);
    const result = await new Promise<T>((resolve, reject) => {
      const request = run(transaction.objectStore(DB_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  }

  return {
    async readAll(organizationId) {
      const all = await withStore<QueuedPosSale[]>("readonly", (store) => store.getAll());
      return (all ?? []).filter((entry) => entry.organizationId === organizationId);
    },
    async put(entry) {
      await withStore("readwrite", (store) => store.put(entry));
    },
    async remove(id) {
      await withStore("readwrite", (store) => store.delete(id));
    },
  };
}

/**
 * In-memory store for tests and for exercising the queue without a browser.
 *
 * Deliberately not a runtime fallback: an in-memory queue looks like it works
 * and loses every queued sale on reload, which is cash in the drawer with no
 * record. Production refuses to trade offline rather than degrade to this.
 */
export function createMemoryQueueStore(): PosQueueStore & { entries: QueuedPosSale[] } {
  const entries: QueuedPosSale[] = [];
  return {
    entries,
    async readAll(organizationId) {
      return entries.filter((entry) => entry.organizationId === organizationId);
    },
    async put(entry) {
      const index = entries.findIndex((row) => row.id === entry.id);
      if (index >= 0) entries[index] = entry;
      else entries.push(entry);
    },
    async remove(id) {
      const index = entries.findIndex((row) => row.id === id);
      if (index >= 0) entries.splice(index, 1);
    },
  };
}

export function createQueuedPosSale(organizationId: string, payload: unknown): QueuedPosSale {
  return {
    id: crypto.randomUUID(),
    organizationId,
    payload,
    createdAt: Date.now(),
  };
}

/**
 * Proves the queue can actually be written and read back.
 *
 * `typeof indexedDB` only proves the global exists. A private window, a locked
 * browser profile or a disabled storage API can still fail on first open, and a
 * queue that cannot persist would drop unpaid sales silently. So we round-trip
 * one throwaway record before trusting the store, and let the caller refuse to
 * trade offline if that fails.
 */
export async function probeQueueStore(
  store: PosQueueStore,
  organizationId: string,
): Promise<boolean> {
  const probe = createQueuedPosSale(organizationId, { probe: true });
  try {
    await store.put(probe);
    const rows = await store.readAll(organizationId);
    const found = rows.some((row) => row.id === probe.id);
    await store.remove(probe.id);
    return found;
  } catch {
    return false;
  }
}
