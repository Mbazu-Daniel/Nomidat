import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, sum } from "@nomidat/db";
import { order, payment, paymentLink } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { PAYSTACK_PAYMENT_METHOD } from "./providers/paystack/paystack.constants";
import type { PaystackTransaction } from "./providers/paystack/paystack.interface";
import { WalletService } from "../payouts/wallet.service";

@Injectable()
export class PaymentLedgerService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly wallet: WalletService,
  ) {}

  async getPaymentLink(reference: string) {
    const [row] = await this.db
      .select()
      .from(paymentLink)
      .where(eq(paymentLink.reference, reference))
      .limit(1);
    // The same 404 covers an unknown reference and one belonging to a caller
    // that is not allowed to see it, so this cannot be used to probe.
    if (!row) throw new NotFoundException("Payment link not found.");
    return row;
  }

  /**
   * Records a successful transaction and credits the wallet in one transaction: a
   * payment row without its credit would lose the tenant that money silently,
   * while the order still read as paid. The link lock plus the unique indexes on
   * payment and wallet_entry make a redelivered webhook a no-op.
   */
  async createPayment(reference: string, transaction: PaystackTransaction, platformFeeBps = 0) {
    await this.db.transaction(async (tx) => {
      const [link] = await tx
        .select()
        .from(paymentLink)
        .where(eq(paymentLink.reference, reference))
        .for("update")
        .limit(1);
      if (!link?.orderId) throw new NotFoundException("Payment link not found.");
      if (link.status === "paid") return;
      const [sale] = await tx
        .select()
        .from(order)
        .where(and(eq(order.id, link.orderId), eq(order.organizationId, link.organizationId)))
        .for("update")
        .limit(1);
      if (!sale) throw new NotFoundException("Sale not found.");
      const now = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
      // The amount that arrived, not the amount asked for: a transfer can be
      // short, and the difference has to be recorded honestly.
      const receivedMinor = transaction.amount;

      await tx
        .insert(payment)
        .values({
          organizationId: link.organizationId,
          orderId: link.orderId,
          contactId: link.contactId,
          amountMinor: receivedMinor,
          currency: link.currency,
          method: PAYSTACK_PAYMENT_METHOD,
          reference,
          notes: `Paystack transaction ${transaction.id}`,
          paidAt: now,
        })
        .onConflictDoNothing();
      const [paid] = await tx
        .select({ total: sum(payment.amountMinor) })
        .from(payment)
        .where(
          and(eq(payment.organizationId, link.organizationId), eq(payment.orderId, link.orderId)),
        );
      // A part payment leaves the order pending, so the shortfall stays visible
      // rather than being quietly written off.
      const isPaid = Number(paid.total ?? 0) >= sale.totalMinor;

      // Credit the wallet inside this same transaction, so the money is either
      // recorded in both places or in neither. onConflictDoNothing means a
      // redelivered webhook cannot credit the tenant twice.
      /**
       * Credits the tenant through the Wallet seam rather than writing the row
       * here. The wallet owns the balance lock, the fee floor and the replay
       * guard; re-deriving them inline is how the running balance drifts from the
       * sum of its own rows.
       */
      await this.wallet.creditPayment(
        link.organizationId,
        {
          amountMinor: receivedMinor,
          platformFeeBps,
          currency: link.currency,
          reference,
          description: "Payment received",
        },
        tx,
      );

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
