import { vi } from "vitest";
import type { DbHandle } from "../db.provider";

/** Queued query results keep service tests independent of a live database. */
export function createDbStub(selectRows: unknown[][] = [], returnedRows: unknown[][] = []) {
  const inserts = vi.fn();
  const updates = vi.fn();
  function query(rows: unknown[][]) {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      for: vi.fn(() => chain),
      onConflictDoNothing: vi.fn(() => chain),
      values: vi.fn((data: unknown) => {
        inserts(data);
        return chain;
      }),
      set: vi.fn((data: unknown) => {
        updates(data);
        return chain;
      }),
      returning: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(rows.shift() ?? []).then(resolve),
    };
    return chain;
  }
  const mock = {
    select: vi.fn(() => query(selectRows)),
    insert: vi.fn(() => query(returnedRows)),
    update: vi.fn(() => query(returnedRows)),
    delete: vi.fn(() => query(returnedRows)),
    execute: vi.fn(),
    transaction: vi.fn(async (callback: (tx: DbHandle) => Promise<unknown>) =>
      callback(mock as unknown as DbHandle),
    ),
  };
  return { db: mock as unknown as DbHandle, inserts, updates, mock };
}
