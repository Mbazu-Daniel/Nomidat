import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull, sql } from "@nomidat/db";
import { product, stock, stockMovement, warehouse } from "@nomidat/db/schema";
import type { StockMovementType } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

type Tx = Pick<DbHandle, "select" | "insert" | "update" | "execute">;

export interface RecordMovementInput {
  productId: string;
  /** Omitted when the product has no variants. */
  variantId?: string | null;
  batchId?: string | null;
  warehouseId: string;
  /** Positive adds stock, negative removes it. */
  quantity: number;
  type: StockMovementType;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  userId?: string | null;
}

/** Movements that must never leave a Stock Level below zero. */
const DECREASING_TYPES: ReadonlySet<StockMovementType> = new Set([
  "outbound_ship",
  "transfer_out",
  "adjustment_remove",
]);

/**
 * The only place stock changes. Every call updates the Stock Level and appends a
 * ledger row in the same transaction, so the two can never disagree.
 */
@Injectable()
export class StockService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  /** Total on hand across every warehouse, for display in product responses. */
  async totalOnHand(organizationId: string, productIds: string[]) {
    if (productIds.length === 0) return new Map<string, number>();

    const rows = await this.db
      .select({ productId: stock.productId, onHand: sql<number>`sum(${stock.onHand})::int` })
      .from(stock)
      .where(
        and(
          eq(stock.organizationId, organizationId),
          sql`${stock.productId} in ${productIds}`,
        ),
      )
      .groupBy(stock.productId);

    return new Map(rows.map((row) => [row.productId, Number(row.onHand ?? 0)]));
  }

  /**
   * On hand for one exact Stock Level, or 0 when the product has never been
   * stocked there. Passing a variant reads that variant's own balance; omitting
   * it reads the product's own. Never both at once, or the two are pooled.
   */
  async onHandAt(
    tx: Pick<DbHandle, "select">,
    organizationId: string,
    productId: string,
    warehouseId: string,
    variantId?: string | null,
  ) {
    const conditions = [
      eq(stock.organizationId, organizationId),
      eq(stock.productId, productId),
      eq(stock.warehouseId, warehouseId),
    ];
    // A null variant is the product's own stock, which is a real row, not a gap.
    conditions.push(variantId ? eq(stock.variantId, variantId) : isNull(stock.variantId));

    const [row] = await tx
      .select({ onHand: stock.onHand })
      .from(stock)
      .where(and(...conditions))
      .limit(1);

    return row?.onHand ?? 0;
  }

  /** Records a movement and returns the new balance. Rolls back on any failure. */
  async recordMovement(organizationId: string, input: RecordMovementInput) {
    return this.db.transaction(async (tx) =>
      this.recordMovementTx(tx, organizationId, input),
    );
  }

  /** Transaction-scoped form, so a sale can move stock and write the order atomically. */
  async recordMovementTx(tx: Tx, organizationId: string, input: RecordMovementInput) {
    if (input.quantity === 0) {
      throw new ConflictException("A stock movement cannot be zero.");
    }

    await this.assertProductAndWarehouse(tx, organizationId, input.productId, input.warehouseId);

    // A variant is its own Stock Level. Reading or writing the variant-less row
    // for a variant movement would silently pool every variant into one balance.
    const previousBalance = await this.onHandAt(
      tx,
      organizationId,
      input.productId,
      input.warehouseId,
      input.variantId,
    );
    const newBalance = previousBalance + input.quantity;

    if (DECREASING_TYPES.has(input.type) && newBalance < 0) {
      throw new ConflictException(
        `Not enough stock. Available: ${previousBalance}, requested: ${Math.abs(input.quantity)}.`,
      );
    }

    // A Stock Level is created on first movement so a new product needs no setup rows.
    // The conflict target must name the same columns, and carry the same null
    // predicate, as the partial unique index that covers this row. Naming the
    // variant-less index for a variant row makes Postgres unable to infer one.
    const variantId = input.variantId ?? null;
    await tx
      .insert(stock)
      .values({ organizationId, productId: input.productId, variantId, warehouseId: input.warehouseId, onHand: newBalance })
      .onConflictDoUpdate(variantId
        ? {
            target: [stock.organizationId, stock.productId, stock.variantId, stock.warehouseId],
            set: { onHand: newBalance, updatedAt: new Date() },
          }
        : {
            target: [stock.organizationId, stock.productId, stock.warehouseId],
            targetWhere: sql`${stock.variantId} is null`,
            set: { onHand: newBalance, updatedAt: new Date() },
          });

    const [movement] = await tx
      .insert(stockMovement)
      .values({
        organizationId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        batchId: input.batchId ?? null,
        warehouseId: input.warehouseId,
        type: input.type,
        quantity: input.quantity,
        previousBalance,
        newBalance,
        referenceId: input.referenceId,
        referenceType: input.referenceType,
        notes: input.notes,
        createdByUserId: input.userId ?? null,
      })
      .returning();

    return movement;
  }

  /**
   * Adjusts the in-transit holding quantity for a stock row. Stock in transit has
   * left its source warehouse but has not yet arrived, so it belongs to neither.
   */
  async adjustInTransit(
    tx: Pick<DbHandle, "update">,
    organizationId: string,
    productId: string,
    variantId: string | null,
    warehouseId: string,
    delta: number,
  ) {
    if (delta === 0) return;

    const conditions = [
      eq(stock.organizationId, organizationId),
      eq(stock.productId, productId),
      eq(stock.warehouseId, warehouseId),
    ];
    // A null variant is the product's own stock, which is a real row, not a gap.
    conditions.push(variantId ? eq(stock.variantId, variantId) : isNull(stock.variantId));

    await tx
      .update(stock)
      .set({ inTransit: sql`greatest(0, ${stock.inTransit} + ${delta})`, updatedAt: new Date() })
      .where(and(...conditions));
  }

  /** The warehouse a terminal should use when the seller has not picked one. */
  async resolveDefaultWarehouseId(organizationId: string): Promise<string> {
    const [found] = await this.db
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(and(eq(warehouse.organizationId, organizationId), eq(warehouse.isDefault, true)))
      .limit(1);

    if (!found) {
      throw new NotFoundException(
        "This business has no warehouse yet. Create one before recording stock.",
      );
    }
    return found.id;
  }

  private async assertProductAndWarehouse(
    tx: Pick<DbHandle, "select">,
    organizationId: string,
    productId: string,
    warehouseId: string,
  ) {
    const [found] = await tx
      .select({ productId: product.id, warehouseId: warehouse.id })
      .from(product)
      .innerJoin(
        warehouse,
        and(
          eq(warehouse.organizationId, organizationId),
          eq(warehouse.id, warehouseId),
        ),
      )
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .limit(1);

    if (!found) {
      throw new NotFoundException("Product or warehouse not found in this business.");
    }
  }
}
