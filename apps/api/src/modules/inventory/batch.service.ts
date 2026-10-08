import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, lte, sql } from "@nomidat/db";
import { batch, product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateBatchDto, ConsumeBatchDto } from "./dto/batch.dto";
import { StockService } from "./stock.service";

/**
 * Batch-tracked goods (anything with an expiry or a lot number).
 *
 * Batch quantity lives here, not on `stock`: a Stock Level is unique per
 * product/variant/warehouse and so cannot hold one row per batch.
 */
@Injectable()
export class BatchService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  async getBatches(
    organizationId: string,
    productId?: string,
    expiringBefore?: Date,
    limit = 50,
    offset = 0,
  ) {
    const rows = await this.db
      .select({
        id: batch.id,
        code: batch.code,
        productId: batch.productId,
        variantId: batch.variantId,
        expiresAt: batch.expiresAt,
        quantityReceived: batch.quantityReceived,
        quantityConsumed: batch.quantityConsumed,
        quantityRemaining: sql<number>`(${batch.quantityReceived} - ${batch.quantityConsumed})`,
      })
      .from(batch)
      .where(
        and(
          eq(batch.organizationId, organizationId),
          productId ? eq(batch.productId, productId) : undefined,
          expiringBefore ? lte(batch.expiresAt, expiringBefore) : undefined,
        ),
      )
      .orderBy(asc(batch.expiresAt))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  /** Registers a batch and books the goods in through the stock ledger. */
  async createBatch(organizationId: string, dto: CreateBatchDto, userId?: string | null) {
    const warehouseId =
      dto.warehouseId ?? (await this.stock.resolveDefaultWarehouseId(organizationId));
    const quantity = Number(dto.quantity);

    if (quantity <= 0) {
      throw new ConflictException("A batch must be received with a quantity above zero.");
    }

    return this.db.transaction(async (tx) => {
      await this.assertProduct(tx, organizationId, dto.productId);

      const [created] = await tx
        .insert(batch)
        .values({
          organizationId,
          productId: dto.productId,
          variantId: dto.variantId ?? null,
          code: dto.code,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          quantityReceived: quantity,
        })
        .returning();

      // The ledger is the only thing allowed to change stock, so the batch row and
      // the inbound movement are written together or not at all.
      await this.stock.recordMovementTx(tx, organizationId, {
        productId: dto.productId,
        variantId: dto.variantId,
        batchId: created.id,
        warehouseId,
        quantity,
        type: "inbound_receive",
        referenceId: created.id,
        referenceType: "batch",
        notes: dto.notes,
        userId,
      });

      return created;
    });
  }

  /** Draws from a batch, refusing to consume more than was received. */
  async consumeBatch(
    organizationId: string,
    batchId: string,
    dto: ConsumeBatchDto,
    userId?: string | null,
  ) {
    const quantity = Number(dto.quantity);
    if (quantity <= 0) {
      throw new ConflictException("A batch consumption must be above zero.");
    }

    return this.db.transaction(async (tx) => {
      const [found] = await tx
        .select({
          id: batch.id,
          productId: batch.productId,
          variantId: batch.variantId,
          received: batch.quantityReceived,
          consumed: batch.quantityConsumed,
        })
        .from(batch)
        .where(and(eq(batch.organizationId, organizationId), eq(batch.id, batchId)))
        .limit(1);

      if (!found) throw new NotFoundException("Batch not found in this business.");

      const remaining = Number(found.received) - Number(found.consumed);
      if (quantity > remaining) {
        throw new ConflictException(`This batch has ${remaining} left. Requested ${quantity}.`);
      }

      const warehouseId =
        dto.warehouseId ?? (await this.stock.resolveDefaultWarehouseId(organizationId));

      await this.stock.recordMovementTx(tx, organizationId, {
        productId: found.productId,
        variantId: found.variantId,
        batchId: found.id,
        warehouseId,
        quantity: -quantity,
        type: dto.type ?? "outbound_ship",
        // Without this the ledger row records a change with no cause, so "which
        // document consumed this batch" has no answer.
        referenceId: found.id,
        referenceType: "batch",
        notes: dto.notes,
        userId,
      });

      // The CHECK constraint on the table is the last line of defence; this read
      // exists so the caller gets a clear message instead of a constraint error.
      await tx
        .update(batch)
        .set({
          quantityConsumed: sql`${batch.quantityConsumed} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(batch.id, found.id));

      return this.getBatch(organizationId, batchId);
    });
  }

  async getBatch(organizationId: string, batchId: string) {
    const [row] = await this.db
      .select({
        id: batch.id,
        code: batch.code,
        productId: batch.productId,
        variantId: batch.variantId,
        expiresAt: batch.expiresAt,
        quantityReceived: batch.quantityReceived,
        quantityConsumed: batch.quantityConsumed,
        quantityRemaining: sql<number>`(${batch.quantityReceived} - ${batch.quantityConsumed})`,
      })
      .from(batch)
      .where(and(eq(batch.organizationId, organizationId), eq(batch.id, batchId)))
      .limit(1);

    if (!row) throw new NotFoundException("Batch not found in this business.");
    return row;
  }

  private async assertProduct(
    tx: Pick<DbHandle, "select">,
    organizationId: string,
    productId: string,
  ) {
    const [found] = await tx
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.organizationId, organizationId), eq(product.id, productId)))
      .limit(1);
    if (!found) throw new NotFoundException("Product not found in this business.");
  }
}
