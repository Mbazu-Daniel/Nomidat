import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { stockReturn, stockReturnItem } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { nextReference } from "./reference";
import { StockService } from "./stock.service";
import type { CreateReturnDto } from "./dto/stock-operations.dto";

type Tx = Pick<DbHandle, "select" | "insert" | "update" | "execute">;

/**
 * Goods coming back from a customer. Restocking is a stock decision, not a
 * side effect: a returned item that is damaged or past its date is written off
 * rather than silently returning to sellable stock.
 */
@Injectable()
export class ReturnService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  async createReturn(organizationId: string, userId: string | null, input: CreateReturnDto) {
    if (!input.items.length) {
      throw new BadRequestException("A return needs at least one line.");
    }

    const subtotalMinor = input.items.reduce(
      (total, line) => total + line.quantity * (line.unitPriceMinor ?? 0),
      0,
    );

    return this.db.transaction(async (tx) => {
      const reference = await nextReference(tx, organizationId, "RET", stockReturn);
      const [created] = await tx
        .insert(stockReturn)
        .values({
          organizationId,
          reference,
          orderId: input.orderId ?? null,
          contactId: input.contactId ?? null,
          status: "draft",
          restock: input.restock ?? true,
          reason: input.reason,
          notes: input.notes,
          subtotalMinor,
          totalMinor: subtotalMinor,
          createdByUserId: userId,
        })
        .returning();

      await tx.insert(stockReturnItem).values(
        input.items.map((line) => {
          const unitPriceMinor = line.unitPriceMinor ?? 0;
          return {
            organizationId,
            returnId: created.id,
            productId: line.productId,
            variantId: line.variantId ?? null,
            quantity: line.quantity,
            unitPriceMinor,
            totalMinor: Math.round(line.quantity * unitPriceMinor),
          };
        }),
      );

      return this.getReturn(organizationId, created.id, tx);
    });
  }

  /**
   * Accepts the goods back. The warehouse is chosen by the caller because a
   * returned item physically arrives somewhere specific.
   */
  async receiveReturn(
    organizationId: string,
    userId: string | null,
    returnId: string,
    warehouseId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(stockReturn)
        .where(and(eq(stockReturn.id, returnId), eq(stockReturn.organizationId, organizationId)))
        .for("update")
        .limit(1);

      if (!record) throw new ConflictException("Return not found.");
      if (record.status !== "draft") {
        throw new ConflictException(`This return is already ${record.status}.`);
      }

      if (record.restock) {
        for (const line of await this.getLines(organizationId, returnId, tx)) {
          await this.stock.recordMovementTx(tx, organizationId, {
            productId: line.productId,
            variantId: line.variantId,
            warehouseId,
            quantity: Number(line.quantity),
            type: "return_in",
            referenceId: record.id,
            referenceType: "stock_return",
            notes: `Restocked from return ${record.reference}`,
            userId,
          });
        }
      }

      const [updated] = await tx
        .update(stockReturn)
        .set({ status: "received", receivedAt: new Date(), updatedAt: new Date() })
        .where(eq(stockReturn.id, returnId))
        .returning();
      return updated;
    });
  }

  getReturns(organizationId: string, limit = 50) {
    return this.db
      .select()
      .from(stockReturn)
      .where(eq(stockReturn.organizationId, organizationId))
      .orderBy(desc(stockReturn.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async getReturn(organizationId: string, returnId: string, tx: Tx = this.db) {
    const [record] = await tx
      .select()
      .from(stockReturn)
      .where(and(eq(stockReturn.id, returnId), eq(stockReturn.organizationId, organizationId)))
      .limit(1);

    if (!record) throw new ConflictException("Return not found.");
    return { ...record, items: await this.getLines(organizationId, returnId, tx) };
  }

  private getLines(organizationId: string, returnId: string, tx: Tx) {
    return tx
      .select()
      .from(stockReturnItem)
      .where(
        and(
          eq(stockReturnItem.returnId, returnId),
          eq(stockReturnItem.organizationId, organizationId),
        ),
      );
  }
}
