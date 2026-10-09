import Dexie, { Table } from "dexie";

export interface QueuedPosSale {
  id: string;
  organizationId: string;
  payload: unknown;
  createdAt: number;
}

/** Storage seam so the queue can be exercised without a browser IndexedDB. */
export interface PosQueueStore {
  readAll(organizationId: string): Promise<QueuedPosSale[]>;
  put(entry: QueuedPosSale): Promise<void>;
  remove(id: string): Promise<void>;
}

class PosDatabase extends Dexie {
  queue!: Table<QueuedPosSale, string>;

  constructor() {
    super("nomidat-pos");
    this.version(1).stores({
      queue: "id, organizationId, createdAt",
    });
  }
}

const db = new PosDatabase();

export function createIndexedDbQueueStore(): PosQueueStore {
  return {
    async readAll(organizationId) {
      return await db.queue.where("organizationId").equals(organizationId).toArray();
    },
    async put(entry) {
      await db.queue.put(entry);
    },
    async remove(id) {
      await db.queue.delete(id);
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
