import { eq, sql } from "@nomidat/db";
import { cycleCount, purchaseOrder, stockReturn, stockTransfer } from "@nomidat/db/schema";
import type { DbHandle } from "../../common/db/db.provider";

/** The org-scoped document tables that carry a human-facing reference. */
type ReferenceTable =
  | typeof stockTransfer
  | typeof cycleCount
  | typeof stockReturn
  | typeof purchaseOrder;

/**
 * Builds the next human-facing reference for a document type. Serialized with an
 * advisory lock so two terminals cannot claim the same number.
 */
export async function nextReference(
  tx: Pick<DbHandle, "select" | "execute">,
  organizationId: string,
  prefix: string,
  table: ReferenceTable,
): Promise<string> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`ref:${organizationId}:${prefix}`}))`,
  );

  const [row] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(table)
    .where(eq(table.organizationId, organizationId));

  return `${prefix}-${String(Number(row?.total ?? 0) + 1).padStart(4, "0")}`;
}
