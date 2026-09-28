import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, inArray, sum } from "@nomidat/db";
import { contact, order, orderItem, payment } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

import type { SaleItemSummary } from "./types";

const MAX_LIMIT = 50;

@Injectable()
export class SalesQueriesService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}
  async listSales(organizationId: string, limit = 20, offset = 0) {
    const rows = await this.db
      .select({
        id: order.id,
        customerId: contact.id,
        customer: contact.name,
        status: order.status,
        subtotalKobo: order.subtotalKobo,
        discountKobo: order.discountKobo,
        taxKobo: order.taxKobo,
        totalKobo: order.totalKobo,
        createdAt: order.createdAt,
      })
      .from(order)
      .leftJoin(contact, eq(order.contactId, contact.id))
      .where(eq(order.organizationId, organizationId))
      .orderBy(desc(order.createdAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));

    if (rows.length === 0) return [];
    const saleIds = rows.map((sale) => sale.id);
    const items = await this.db
      .select({
        orderId: orderItem.orderId,
        productName: orderItem.productName,
        quantity: orderItem.quantity,
      })
      .from(orderItem)
      .where(inArray(orderItem.orderId, saleIds))
      .orderBy(orderItem.id);
    const totals = await this.db
      .select({ orderId: payment.orderId, amount: sum(payment.amountKobo) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), inArray(payment.orderId, saleIds)))
      .groupBy(payment.orderId);
    const amounts = new Map(totals.map((row) => [row.orderId, Number(row.amount ?? 0)]));
    const itemsBySale = new Map<string, SaleItemSummary[]>();
    for (const item of items) {
      const group = itemsBySale.get(item.orderId) ?? [];
      group.push({ productName: item.productName ?? "Unnamed item", quantity: item.quantity });
      itemsBySale.set(item.orderId, group);
    }
    return rows.map((sale) => ({
      ...sale,
      saleReference: `SALE-${sale.id.replaceAll("-", "").slice(-12).toUpperCase()}`,
      saleItems: itemsBySale.get(sale.id) ?? [],
      paidKobo: amounts.get(sale.id) ?? 0,
      balanceKobo: Math.max(0, sale.totalKobo - (amounts.get(sale.id) ?? 0)),
    }));
  }

  async getCustomerBalance(organizationId: string, customerId: string) {
    const [customer] = await this.db
      .select({ id: contact.id, name: contact.name })
      .from(contact)
      .where(and(eq(contact.id, customerId), eq(contact.organizationId, organizationId)))
      .limit(1);

    if (!customer) throw new NotFoundException("Customer not found.");

    const pendingSales = await this.db
      .select({ id: order.id, totalKobo: order.totalKobo, createdAt: order.createdAt })
      .from(order)
      .where(
        and(
          eq(order.organizationId, organizationId),
          eq(order.contactId, customerId),
          eq(order.status, "pending"),
        ),
      )
      .orderBy(desc(order.createdAt));

    const balances = await Promise.all(
      pendingSales.map(async (sale) => ({
        ...sale,
        paidKobo: await this.getPaidAmount(organizationId, sale.id),
      })),
    );

    return {
      customer,
      outstandingKobo: Math.max(
        0,
        balances.reduce((total, sale) => total + sale.totalKobo - sale.paidKobo, 0),
      ),
      pendingSales: balances,
    };
  }

  async getSale(organizationId: string, saleId: string, tx: Pick<DbHandle, "select"> = this.db) {
    const [sale] = await tx
      .select({
        id: order.id,
        customerId: contact.id,
        customer: contact.name,
        status: order.status,
        subtotalKobo: order.subtotalKobo,
        discountKobo: order.discountKobo,
        taxKobo: order.taxKobo,
        totalKobo: order.totalKobo,
        currency: order.currency,
        paidAt: order.paidAt,
        paymentReference: order.paymentReference,
        notes: order.notes,
        createdAt: order.createdAt,
      })
      .from(order)
      .leftJoin(contact, eq(order.contactId, contact.id))
      .where(and(eq(order.id, saleId), eq(order.organizationId, organizationId)))
      .limit(1);

    if (!sale) throw new NotFoundException("Sale not found.");

    const items = await tx
      .select({
        id: orderItem.id,
        productId: orderItem.productId,
        productName: orderItem.productName,
        quantity: orderItem.quantity,
        unitPriceKobo: orderItem.unitPriceKobo,
        totalKobo: orderItem.totalKobo,
      })
      .from(orderItem)
      .where(eq(orderItem.orderId, saleId));

    const payments = await tx
      .select({
        id: payment.id,
        amountKobo: payment.amountKobo,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        paidAt: payment.paidAt,
      })
      .from(payment)
      .where(and(eq(payment.orderId, saleId), eq(payment.organizationId, organizationId)))
      .orderBy(desc(payment.paidAt));

    const paidKobo = payments.reduce((total, item) => total + item.amountKobo, 0);

    return {
      ...sale,
      items,
      payments,
      paidKobo,
      balanceKobo: Math.max(0, sale.totalKobo - paidKobo),
    };
  }

  private async getPaidAmount(organizationId: string, saleId: string) {
    return this.getPaidAmountTx(this.db, organizationId, saleId);
  }

  private async getPaidAmountTx(
    tx: Pick<DbHandle, "select">,
    organizationId: string,
    saleId: string,
  ) {
    const [result] = await tx
      .select({ totalKobo: sum(payment.amountKobo) })
      .from(payment)
      .where(and(eq(payment.organizationId, organizationId), eq(payment.orderId, saleId)));

    return Number(result?.totalKobo ?? 0);
  }
}
