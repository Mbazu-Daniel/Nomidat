import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { cycleCount, cycleCountLine } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { nextReference } from "./reference";
import { StockService } from "./stock.service";
import type { CreateCycleCountDto } from "./dto/stock-operations.dto";

type Tx = Pick<DbHandle, "select" | "insert" | "update" | "execute">;

/**
 * A physical count of one warehouse. The correction posted is always the
 * difference between what was counted and what the system expected — never the
 * counted figure itself, which would wipe out history.
 */
@Injectable()
export class CycleCountService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  async createCycleCount(
    organizationId: string,
    userId: string | null,
    input: CreateCycleCountDto,
  ) {
    return this.db.transaction(async (tx) => {
      const reference = await nextReference(tx, organizationId, "CNT", cycleCount);
      const [created] = await tx
        .insert(cycleCount)
        .values({
          organizationId,
          reference,
          warehouseId: input.warehouseId,
          status: "draft",
          notes: input.notes,
          createdByUserId: userId,
        })
        .returning();

      // Snapshot what the system believed at the moment the count started, so a
      // sale that lands mid-count cannot silently change what the counter saw.
      for (const line of input.items) {
        const expectedQuantity = await this.stock.onHandAt(
          tx,
          organizationId,
          line.productId,
          input.warehouseId,
          line.variantId,
        );
        await tx.insert(cycleCountLine).values({
          organizationId,
          cycleCountId: created.id,
          productId: line.productId,
          variantId: line.variantId ?? null,
          expectedQuantity,
          countedQuantity: line.countedQuantity,
        });
      }

      const [updated] = await tx
        .update(cycleCount)
        .set({ status: "counted", countedAt: new Date(), updatedAt: new Date() })
        .where(eq(cycleCount.id, created.id))
        .returning();

      return this.getCycleCount(organizationId, updated.id, tx);
    });
  }

  /** Posts one correction per line, sized by the difference the counter found. */
  async applyCycleCount(organizationId: string, userId: string | null, cycleCountId: string) {
    return this.db.transaction(async (tx) => {
      const [count] = await tx
        .select()
        .from(cycleCount)
        .where(and(eq(cycleCount.id, cycleCountId), eq(cycleCount.organizationId, organizationId)))
        .for("update")
        .limit(1);

      if (!count) throw new ConflictException("Cycle count not found.");
      if (count.status !== "counted") {
        throw new ConflictException(`This count is already ${count.status}.`);
      }

      const lines = await this.getLines(organizationId, cycleCountId, tx);
      for (const line of lines) {
        const difference = Number(line.countedQuantity ?? 0) - Number(line.expectedQuantity);
        if (difference === 0) continue;

        await this.stock.recordMovementTx(tx, organizationId, {
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: count.warehouseId,
          quantity: difference,
          type: "cycle_count_correction",
          referenceId: count.id,
          referenceType: "cycle_count",
          notes: `Count ${count.reference}: counted ${line.countedQuantity}, expected ${line.expectedQuantity}`,
          userId,
        });
      }

      const [updated] = await tx
        .update(cycleCount)
        .set({ status: "applied", appliedAt: new Date(), updatedAt: new Date() })
        .where(eq(cycleCount.id, cycleCountId))
        .returning();

      return updated;
    });
  }

  getCycleCounts(organizationId: string, limit = 50) {
    return this.db
      .select()
      .from(cycleCount)
      .where(eq(cycleCount.organizationId, organizationId))
      .orderBy(desc(cycleCount.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async getCycleCount(organizationId: string, cycleCountId: string, tx: Tx = this.db) {
    const [count] = await tx
      .select()
      .from(cycleCount)
      .where(and(eq(cycleCount.id, cycleCountId), eq(cycleCount.organizationId, organizationId)))
      .limit(1);

    if (!count) throw new ConflictException("Cycle count not found.");
    return { ...count, items: await this.getLines(organizationId, cycleCountId, tx) };
  }

  private getLines(organizationId: string, cycleCountId: string, tx: Tx) {
    return tx
      .select()
      .from(cycleCountLine)
      .where(
        and(
          eq(cycleCountLine.cycleCountId, cycleCountId),
          eq(cycleCountLine.organizationId, organizationId),
        ),
      );
  }
}
