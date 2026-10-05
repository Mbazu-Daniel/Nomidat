import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { stockTransfer, stockTransferItem } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { nextReference } from "./reference";
import { StockService } from "./stock.service";
import type { CreateTransferDto } from "./dto/stock-operations.dto";

type Tx = Pick<DbHandle, "select" | "insert" | "update" | "execute">;

/**
 * Moving stock between warehouses. A transfer is two movements made at two
 * different times: stock leaves the source when dispatched and only reaches the
 * destination when received. While in transit it belongs to neither warehouse, so
 * no single warehouse over-reports what it holds.
 */
@Injectable()
export class TransferService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  async createTransfer(organizationId: string, input: CreateTransferDto) {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new BadRequestException("Source and destination warehouses must be different.");
    }
    if (!input.items.length) {
      throw new BadRequestException("A transfer needs at least one line.");
    }

    return this.db.transaction(async (tx) => {
      const reference = await nextReference(tx, organizationId, "TRF", stockTransfer);
      const [created] = await tx
        .insert(stockTransfer)
        .values({
          organizationId,
          reference,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          status: "draft",
          notes: input.notes,
        })
        .returning();

      await tx.insert(stockTransferItem).values(
        input.items.map((line) => ({
          organizationId,
          transferId: created.id,
          productId: line.productId,
          variantId: line.variantId ?? null,
          quantity: line.quantity,
        })),
      );

      return this.getTransfer(organizationId, created.id, tx);
    });
  }

  /** Takes the goods out of the source warehouse and marks them in transit. */
  async dispatchTransfer(organizationId: string, userId: string | null, transferId: string) {
    return this.db.transaction(async (tx) => {
      const transfer = await this.lockTransfer(tx, organizationId, transferId);
      if (transfer.status !== "draft") {
        throw new ConflictException(`This transfer is already ${transfer.status}.`);
      }

      for (const line of await this.getLines(organizationId, transferId, tx)) {
        const quantity = Number(line.quantity);
        // Throws if the source cannot cover it, so no partial dispatch is possible.
        await this.stock.recordMovementTx(tx, organizationId, {
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: transfer.fromWarehouseId,
          quantity: -quantity,
          type: "transfer_out",
          referenceId: transfer.id,
          referenceType: "stock_transfer",
          notes: `Dispatched on ${transfer.reference}`,
          userId,
        });
        await this.stock.adjustInTransit(
          tx,
          organizationId,
          line.productId,
          line.variantId,
          transfer.fromWarehouseId,
          quantity,
        );
      }

      const [updated] = await tx
        .update(stockTransfer)
        .set({ status: "in_transit", dispatchedAt: new Date(), updatedAt: new Date() })
        .where(eq(stockTransfer.id, transferId))
        .returning();
      return updated;
    });
  }

  /** Puts the goods into the destination warehouse, clearing the in-transit hold. */
  async receiveTransfer(organizationId: string, userId: string | null, transferId: string) {
    return this.db.transaction(async (tx) => {
      const transfer = await this.lockTransfer(tx, organizationId, transferId);
      if (transfer.status !== "in_transit") {
        throw new ConflictException("Only a transfer in transit can be received.");
      }

      for (const line of await this.getLines(organizationId, transferId, tx)) {
        const quantity = Number(line.quantity);
        await this.stock.recordMovementTx(tx, organizationId, {
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: transfer.toWarehouseId,
          quantity,
          type: "transfer_in",
          referenceId: transfer.id,
          referenceType: "stock_transfer",
          notes: `Received on ${transfer.reference}`,
          userId,
        });
        await this.stock.adjustInTransit(
          tx,
          organizationId,
          line.productId,
          line.variantId,
          transfer.fromWarehouseId,
          -quantity,
        );
      }

      const [updated] = await tx
        .update(stockTransfer)
        .set({ status: "received", receivedAt: new Date(), updatedAt: new Date() })
        .where(eq(stockTransfer.id, transferId))
        .returning();
      return updated;
    });
  }

  getTransfers(organizationId: string, limit = 50) {
    return this.db
      .select()
      .from(stockTransfer)
      .where(eq(stockTransfer.organizationId, organizationId))
      .orderBy(desc(stockTransfer.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async getTransfer(organizationId: string, transferId: string, tx: Tx = this.db) {
    const [transfer] = await tx
      .select()
      .from(stockTransfer)
      .where(and(eq(stockTransfer.id, transferId), eq(stockTransfer.organizationId, organizationId)))
      .limit(1);

    if (!transfer) throw new NotFoundException("Transfer not found.");
    return { ...transfer, items: await this.getLines(organizationId, transferId, tx) };
  }

  private getLines(organizationId: string, transferId: string, tx: Tx) {
    return tx
      .select()
      .from(stockTransferItem)
      .where(
        and(
          eq(stockTransferItem.transferId, transferId),
          eq(stockTransferItem.organizationId, organizationId),
        ),
      );
  }

  private async lockTransfer(tx: Tx, organizationId: string, transferId: string) {
    const [transfer] = await tx
      .select()
      .from(stockTransfer)
      .where(and(eq(stockTransfer.id, transferId), eq(stockTransfer.organizationId, organizationId)))
      .for("update")
      .limit(1);

    if (!transfer) throw new NotFoundException("Transfer not found.");
    return transfer;
  }
}

