import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, sum } from "@nomidat/db";
import { order, payment, paymentLink } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { PaystackTransaction } from "./providers/paystack/paystack.interface";

@Injectable()
export class PaymentLedgerService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getPaymentLink(reference: string) {
    const [row] = await this.db
      .select()
      .from(paymentLink)
      .where(eq(paymentLink.reference, reference))
      .limit(1);
    if (!row) throw new BadRequestException("Payment reference not found.");
    return row;
  }

  async createPayment(reference: string, transaction: PaystackTransaction) {
    await this.db.transaction(async (tx) => {
      const [link] = await tx
        .select()
        .from(paymentLink)
        .where(eq(paymentLink.reference, reference))
        .for("update")
        .limit(1);
      if (!link?.orderId) throw new BadRequestException("Payment link is not attached to a sale.");
      if (link.status === "paid") return;
      const [sale] = await tx
        .select()
        .from(order)
        .where(and(eq(order.id, link.orderId), eq(order.organizationId, link.organizationId)))
        .for("update")
        .limit(1);
      if (!sale) throw new BadRequestException("Sale not found.");
      const now = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
      await tx
        .insert(payment)
        .values({
          organizationId: link.organizationId,
          orderId: link.orderId,
          contactId: link.contactId,
          amountKobo: link.amountKobo,
          currency: link.currency,
          method: "paystack",
          reference,
          notes: `Paystack transaction ${transaction.id}`,
          paidAt: now,
        })
        .onConflictDoNothing();
      const [paid] = await tx
        .select({ total: sum(payment.amountKobo) })
        .from(payment)
        .where(
          and(eq(payment.organizationId, link.organizationId), eq(payment.orderId, link.orderId)),
        );
      const isPaid = Number(paid.total ?? 0) >= sale.totalKobo;
      await tx
        .update(order)
        .set({
          status: isPaid ? "paid" : "pending",
          paidAt: isPaid ? now : null,
          paymentReference: reference,
          updatedAt: now,
        })
        .where(and(eq(order.id, link.orderId), eq(order.organizationId, link.organizationId)));
      await tx
        .update(paymentLink)
        .set({ status: "paid", paidAt: now, updatedAt: now })
        .where(eq(paymentLink.id, link.id));
    });
  }
}
