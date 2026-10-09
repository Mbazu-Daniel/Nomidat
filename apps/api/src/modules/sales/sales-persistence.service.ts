import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "@nomidat/db";
import { contact, order, orderItem, payment } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { StockService } from "../inventory/stock.service";
import { claimSerials } from "./sales-serial-claims";
import type { PricedSaleLine, SaleOrderInput, SaleTotals } from "./types/sales.type";

/**
 * Writes a sale and its stock movements. Split from SalesService so the POS module
 * reuses one transactional implementation of decrement-and-record.
 */
@Injectable()
export class SalesPersistenceService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  /**
   * Human-facing sequential reference per organization. Serialized by the caller's
   * transaction so concurrent terminals cannot claim the same number.
   */
  async nextOrderNumber(
    tx: Pick<DbHandle, "select" | "execute">,
    organizationId: string,
  ): Promise<string> {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`order-number:${organizationId}`}))`,
    );

    const [row] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(order)
      .where(eq(order.organizationId, organizationId));

    return `ORD-${String(Number(row?.total ?? 0) + 1).padStart(4, "0")}`;
  }

  /** Offline terminals replay queued sales; a repeated reference returns the original id. */
  async getOrderIdByClientReference(organizationId: string, clientReference: string) {
    const [existing] = await this.db
      .select({ id: order.id })
      .from(order)
      .where(
        and(eq(order.organizationId, organizationId), eq(order.clientReference, clientReference)),
      )
      .limit(1);

    return existing?.id ?? null;
  }

  async persistSale(
    tx: Pick<DbHandle, "select" | "insert" | "update" | "execute">,
    organizationId: string,
    userId: string | null,
    input: SaleOrderInput,
    lines: PricedSaleLine[],
    totals: SaleTotals,
    currency: string,
  ) {
    const contactId = await this.resolveContactId(tx, organizationId, input.customerId);
    const now = new Date();
    const settled = totals.paymentAmountMinor === totals.totalMinor;
    const orderNumber = await this.nextOrderNumber(tx, organizationId);
    const warehouseId = await this.stock.resolveDefaultWarehouseId(organizationId);

    const [createdOrder] = await tx
      .insert(order)
      .values({
        organizationId,
        orderNumber,
        contactId,
        status: settled ? "paid" : "pending",
        source: input.source ?? "manual",
        subtotalMinor: totals.subtotalMinor,
        discountMinor: totals.discountMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        currency,
        paidAt: settled ? now : null,
        completedAt: settled ? now : null,
        paymentReference: input.paymentReference,
        paymentProvider: input.paymentProvider,
        // On the order as well as the Payment row, because a sale on credit writes
        // no Payment row at all and would otherwise record only that money is owed,
        // never how it is arriving.
        paymentMethod: input.paymentMethod ?? "cash",
        clientReference: input.clientReference ?? null,
        fulfilmentType: input.fulfilmentType ?? null,
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Movements reference the order, so the order is written first. A stock
    // shortfall throws here and rolls the whole sale back, order included.
    const resolvedItems = await this.resolveSaleItems(
      tx,
      organizationId,
      lines,
      warehouseId,
      createdOrder.id,
    );

    await tx.insert(orderItem).values(
      resolvedItems.map((item) => ({
        orderId: createdOrder.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        productSku: item.productSku,
        note: item.note ?? null,
        discountMinor: item.discountMinor,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        totalMinor: item.totalMinor,
      })),
    );

    if (totals.paymentAmountMinor > 0) {
      await tx.insert(payment).values({
        organizationId,
        orderId: createdOrder.id,
        contactId,
        amountMinor: totals.paymentAmountMinor,
        currency,
        method: input.paymentMethod ?? "cash",
        reference: input.paymentReference,
        createdByUserId: userId,
        paidAt: now,
      });
    }

    return createdOrder;
  }

  private async resolveContactId(
    tx: Pick<DbHandle, "select">,
    organizationId: string,
    customerId?: string,
  ) {
    if (!customerId) return null;

    const [found] = await tx
      .select({ id: contact.id })
      .from(contact)
      .where(and(eq(contact.id, customerId), eq(contact.organizationId, organizationId)))
      .limit(1);

    if (!found) throw new BadRequestException("Customer not found.");
    return found.id;
  }

  /**
   * Records an outbound movement for every catalogued line. The Stock Level and its
   * ledger row are written together, so stock and its history cannot disagree.
   *
   * Name, sku, price and quantity already come from the pricing seam, so this walks
   * lines it has been given rather than deciding anything about them. An ad-hoc
   * line moves no stock: it names something that was never in the catalog.
   */
  private async resolveSaleItems(
    tx: Pick<DbHandle, "select" | "update" | "insert" | "execute">,
    organizationId: string,
    items: PricedSaleLine[],
    warehouseId: string,
    orderId: string,
  ) {
    for (const item of items) {
      if (!item.productId) continue;

      // Throws when the warehouse cannot cover the sale, so the whole order rolls back.
      await this.stock.recordMovementTx(tx, organizationId, {
        productId: item.productId,
        variantId: item.variantId ?? null,
        warehouseId,
        quantity: -item.quantity,
        type: "outbound_ship",
        referenceId: orderId,
        referenceType: "order",
        notes: `Sold ${item.productName}`,
      });

      await claimSerials(
        tx,
        organizationId,
        item.serialNumberIds,
        item.productId,
        item.variantId ?? null,
        item.quantity,
        orderId,
      );
    }

    return items.map((item) => ({
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      productName: item.productName,
      productSku: item.productSku,
      note: item.note ?? null,
      discountMinor: item.discountMinor ?? 0,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      totalMinor: item.lineTotalMinor,
    }));
  }
}
