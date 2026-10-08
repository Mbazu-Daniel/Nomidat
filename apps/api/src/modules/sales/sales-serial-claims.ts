import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { and, eq, sql } from "@nomidat/db";
import { serialNumber } from "@nomidat/db/schema";
import type { DbHandle } from "../../common/db/db.provider";

type ClaimSerialsTx = Pick<DbHandle, "select" | "update">;

/**
 * Marks the exact serials sold and ties them to the order, inside the sale's
 * own transaction. A serial already sold, or one belonging to another product
 * or tenant, throws here and the entire order rolls back — so a unit can never
 * be sold twice, and a sale can never leave a serial stranded in stock while
 * its Stock Level was drawn down.
 *
 * Split from SalesPersistenceService so that file stays within the 300-line
 * limit without weakening this guard.
 */
export async function claimSerials(
  tx: ClaimSerialsTx,
  organizationId: string,
  serialNumberIds: string[] | undefined,
  productId: string,
  variantId: string | null,
  quantity: number,
  orderId: string,
) {
  if (!serialNumberIds) return;

  if (serialNumberIds.length !== quantity) {
    throw new BadRequestException(
      `This product is tracked by serial: ${quantity} unit(s) sold needs ${quantity} serial code(s), got ${serialNumberIds.length}.`,
    );
  }
  if (new Set(serialNumberIds).size !== serialNumberIds.length) {
    throw new BadRequestException("The same serial was named twice on one sale.");
  }

  const rows = await tx
    .select({
      id: serialNumber.id,
      code: serialNumber.code,
      status: serialNumber.status,
      productId: serialNumber.productId,
      variantId: serialNumber.variantId,
    })
    .from(serialNumber)
    .where(
      and(
        eq(serialNumber.organizationId, organizationId),
        sql`${serialNumber.id} in ${serialNumberIds}`,
      ),
    )
    .for("update");

  if (rows.length !== serialNumberIds.length) {
    throw new NotFoundException("One or more serial numbers were not found.");
  }

  for (const row of rows) {
    if (row.productId !== productId) {
      throw new BadRequestException(`Serial ${row.code} belongs to a different product.`);
    }
    if ((row.variantId ?? null) !== variantId) {
      throw new BadRequestException(`Serial ${row.code} belongs to a different option.`);
    }
    if (row.status !== "in_stock") {
      throw new ConflictException(`Serial ${row.code} is already ${row.status.replace("_", " ")}.`);
    }
  }

  await tx
    .update(serialNumber)
    .set({ status: "sold", soldAt: new Date(), orderId, updatedAt: new Date() })
    .where(
      and(
        eq(serialNumber.organizationId, organizationId),
        sql`${serialNumber.id} in ${serialNumberIds}`,
      ),
    );
}
