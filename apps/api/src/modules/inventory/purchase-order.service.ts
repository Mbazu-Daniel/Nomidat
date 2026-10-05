import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { product, purchaseOrder, purchaseOrderItem } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { nextReference } from "./reference";
import { StockService } from "./stock.service";
import type { CreatePurchaseOrderDto, ReceivePurchaseOrderDto } from "./dto/stock-operations.dto";

type Tx = Pick<DbHandle, "select" | "insert" | "update" | "execute">;

/**
 * Ordering from a supplier. Receiving posts a real inbound movement per line, so
 * stock history shows goods arriving, not just a total going up.
 */
@Injectable()
export class PurchaseOrderService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  async createPurchaseOrder(
    organizationId: string,
    userId: string | null,
    input: CreatePurchaseOrderDto,
  ) {
    if (!input.items.length) {
      throw new BadRequestException("A purchase order needs at least one line.");
    }

    const subtotalMinor = input.items.reduce(
      (total, line) => total + Math.round(line.quantityOrdered * line.unitCostMinor),
      0,
    );

    return this.db.transaction(async (tx) => {
      const reference = await nextReference(tx, organizationId, "PO", purchaseOrder);
      const [created] = await tx
        .insert(purchaseOrder)
        .values({
          organizationId,
          reference,
          supplierId: input.supplierId ?? null,
          warehouseId: input.warehouseId,
          status: "ordered",
          expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
          orderedAt: new Date(),
          notes: input.notes,
          subtotalMinor,
          totalMinor: subtotalMinor,
          createdByUserId: userId,
        })
        .returning();

      await tx.insert(purchaseOrderItem).values(
        input.items.map((line) => ({
          organizationId,
          purchaseOrderId: created.id,
          productId: line.productId,
          variantId: line.variantId ?? null,
          quantityOrdered: line.quantityOrdered,
          unitCostMinor: line.unitCostMinor,
          totalMinor: Math.round(line.quantityOrdered * line.unitCostMinor),
        })),
      );

      return this.getPurchaseOrder(organizationId, created.id, tx);
    });
  }

  /**
   * Books in what physically arrived. Partial deliveries are normal, so each line
   * tracks what is still outstanding and the order closes only when none remain.
   */
  async receivePurchaseOrder(
    organizationId: string,
    userId: string | null,
    purchaseOrderId: string,
    input: ReceivePurchaseOrderDto,
  ) {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(purchaseOrder)
        .where(
          and(
            eq(purchaseOrder.id, purchaseOrderId),
            eq(purchaseOrder.organizationId, organizationId),
          ),
        )
        .for("update")
        .limit(1);

      if (!order) throw new ConflictException("Purchase order not found.");
      if (order.status === "received" || order.status === "cancelled") {
        throw new ConflictException(`This purchase order is already ${order.status}.`);
      }

      const lines = await this.getLines(organizationId, purchaseOrderId, tx);
      const receivedByLine = new Map<string, number>();

      for (const received of input.items) {
        const line = lines.find(
          (row) =>
            row.productId === received.productId &&
            (row.variantId ?? null) === (received.variantId ?? null),
        );
        // A delivery naming something not on the order is a data-entry error, not
        // a reason to silently ignore it.
        if (!line) {
          throw new NotFoundException("A received item is not on this purchase order.");
        }

        const outstanding =
          Number(line.quantityOrdered) - Number(line.quantityReceived);
        const quantity = Math.min(received.countedQuantity, outstanding);
        if (quantity <= 0) continue;

        await this.stock.recordMovementTx(tx, organizationId, {
          productId: line.productId,
          variantId: line.variantId,
          warehouseId: order.warehouseId,
          quantity,
          type: "inbound_receive",
          referenceId: order.id,
          referenceType: "purchase_order",
          notes: `Received on ${order.reference}`,
          userId,
        });

        await tx
          .update(purchaseOrderItem)
          .set({ quantityReceived: Number(line.quantityReceived) + quantity })
          .where(eq(purchaseOrderItem.id, line.id));

        receivedByLine.set(
          line.id,
          (receivedByLine.get(line.id) ?? 0) + quantity,
        );
      }

      // Judged across every line, not only the ones named in this request: a PO
      // whose second line was never delivered must not close as received just
      // because this delivery mentioned only the first.
      //
      // `lines` was read before the updates above, so this delivery's quantities
      // are added back on. A line counts complete only once its running total
      // reaches what was ordered.
      const complete = lines.every((row) => {
        const total = Number(row.quantityReceived) + (receivedByLine.get(row.id) ?? 0);
        return total >= Number(row.quantityOrdered);
      });

      const [updated] = await tx
        .update(purchaseOrder)
        .set({
          status: complete ? "received" : "partial",
          receivedAt: complete ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(purchaseOrder.id, purchaseOrderId), eq(purchaseOrder.organizationId, organizationId)))
        .returning();

      return updated;
    });
  }

  getPurchaseOrders(organizationId: string, limit = 50) {
    return this.db
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.organizationId, organizationId))
      .orderBy(desc(purchaseOrder.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async getPurchaseOrder(organizationId: string, purchaseOrderId: string, tx: Tx = this.db) {
    const [order] = await tx
      .select()
      .from(purchaseOrder)
      .where(
        and(
          eq(purchaseOrder.id, purchaseOrderId),
          eq(purchaseOrder.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!order) throw new ConflictException("Purchase order not found.");
    return { ...order, items: await this.getLines(organizationId, purchaseOrderId, tx) };
  }

  private getLines(organizationId: string, purchaseOrderId: string, tx: Tx) {
    return tx
      .select({
        id: purchaseOrderItem.id,
        productId: purchaseOrderItem.productId,
        variantId: purchaseOrderItem.variantId,
        quantityOrdered: purchaseOrderItem.quantityOrdered,
        quantityReceived: purchaseOrderItem.quantityReceived,
        // Without the name a caller can only render a uuid, which is no use to
        // the person deciding what actually arrived.
        productName: product.name,
      })
      .from(purchaseOrderItem)
      .innerJoin(product, eq(product.id, purchaseOrderItem.productId))
      .where(
        and(
          eq(purchaseOrderItem.purchaseOrderId, purchaseOrderId),
          eq(purchaseOrderItem.organizationId, organizationId),
        ),
      );
  }
}

