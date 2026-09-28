import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "@nomidat/db";
import { contact, order, orderItem, payment } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
@Injectable()
export class ReceiptsService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}
  async getReceipt(organizationId: string, saleId: string) {
    const [sale] = await this.db
      .select({
        id: order.id,
        customerId: contact.id,
        customer: contact.name,
        totalKobo: order.totalKobo,
        currency: order.currency,
        createdAt: order.createdAt,
      })
      .from(order)
      .leftJoin(contact, eq(order.contactId, contact.id))
      .where(and(eq(order.id, saleId), eq(order.organizationId, organizationId)))
      .limit(1);

    if (!sale) throw new NotFoundException("Sale not found.");

    const items = await this.db
      .select({
        id: orderItem.id,
        description: orderItem.productName,
        quantity: orderItem.quantity,
        unitPriceKobo: orderItem.unitPriceKobo,
        totalKobo: orderItem.totalKobo,
      })
      .from(orderItem)
      .where(eq(orderItem.orderId, saleId));

    const payments = await this.db
      .select({
        id: payment.id,
        amountKobo: payment.amountKobo,
        method: payment.method,
        reference: payment.reference,
        paidAt: payment.paidAt,
      })
      .from(payment)
      .where(and(eq(payment.orderId, saleId), eq(payment.organizationId, organizationId)))
      .orderBy(desc(payment.paidAt));

    const paidKobo = payments.reduce((total, item) => total + item.amountKobo, 0);

    return {
      receiptNumber: `RCPT-${sale.id.slice(0, 8).toUpperCase()}`,
      sale,
      items,
      payments,
      paidKobo,
      balanceKobo: Math.max(0, sale.totalKobo - paidKobo),
    };
  }
}
