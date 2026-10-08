import type { PosQueueStore, QueuedPosSale } from "./pos-queue";

export interface PosReplayResult {
  replayed: number;
  remaining: number;
  /** Set when a queued sale is permanently rejected, e.g. stock sold out. */
  failure?: string;
}

/**
 * Replays queued sales oldest-first. Processing stops at the first failure so a
 * later sale can never settle ahead of an earlier one, which would scramble the
 * seller's cash drawer reconciliation.
 */
export async function replayQueuedPosSales(
  store: PosQueueStore,
  organizationId: string,
  submit: (entry: QueuedPosSale) => Promise<void>,
): Promise<PosReplayResult> {
  const queued = (await store.readAll(organizationId)).sort(
    (left, right) => left.createdAt - right.createdAt,
  );

  let replayed = 0;
  for (const entry of queued) {
    try {
      await submit(entry);
    } catch (reason) {
      return {
        replayed,
        remaining: queued.length - replayed,
        failure: reason instanceof Error ? reason.message : String(reason),
      };
    }
    await store.remove(entry.id);
    replayed += 1;
  }

  return { replayed, remaining: queued.length - replayed };
}
