import { describe, it, expect, vi } from "vitest";
import { createDbStub } from "../../../common/db/test/db.stub";
import { PaymentLedgerService } from "../payment-ledger.service";
import { PaymentReconciliationService } from "../payment-reconciliation.service";
import { PaymentNotificationService } from "../payment-notification.service";
import type { PaystackService } from "../providers/paystack/paystack.service";
import type { PaystackTransaction } from "../providers/paystack/paystack.interface";
import type { TelegramClient } from "../../telegram/telegram.client";
import type { WhatsAppClient } from "../../whatsapp/whatsapp.client";
const link = {
  id: "link",
  organizationId: "shop",
  orderId: "sale",
  contactId: null,
  amountKobo: 5000,
  currency: "NGN",
  status: "pending",
  reference: "ref",
};
describe("payment bookkeeping", () => {
  it("does not double-record a payment already marked paid", async () => {
    const { db, inserts, updates } = createDbStub([[{ ...link, status: "paid" }]]);
    await new PaymentLedgerService(db).createPayment("ref", { id: 1 } as PaystackTransaction);
    expect(inserts).not.toHaveBeenCalled();
    expect(updates).not.toHaveBeenCalled();
  });
  it("keeps a partially paid sale pending and marks its payment link paid", async () => {
    const { db, inserts, updates } = createDbStub([
      [link],
      [{ totalKobo: 10000 }],
      [{ total: 5000 }],
    ]);
    await new PaymentLedgerService(db).createPayment("ref", {
      id: 1,
      paid_at: "2026-09-24T10:00:00Z",
    } as PaystackTransaction);
    expect(inserts).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "shop",
        orderId: "sale",
        amountKobo: 5000,
        reference: "ref",
      }),
    );
    expect(updates.mock.calls[0][0]).toMatchObject({ status: "pending", paidAt: null });
    expect(updates.mock.calls[1][0]).toMatchObject({ status: "paid" });
  });
  it("continues reconciliation after one provider failure", async () => {
    const { db } = createDbStub([
      [link, { ...link, id: "second", status: "paid", reference: "second" }],
      [],
    ]);
    const verifyPayment = vi.fn().mockRejectedValue(new Error("Temporary provider failure"));
    const createNotification = vi.fn();
    await new PaymentReconciliationService(
      db,
      { verifyPayment } as unknown as PaystackService,
      { createNotification } as unknown as PaymentNotificationService,
    ).updatePayments();
    expect(verifyPayment).toHaveBeenCalledWith("shop", "ref");
    expect(createNotification).toHaveBeenCalledWith("second");
  });
  it("uses a WhatsApp template outside the reply window", async () => {
    const { db, updates } = createDbStub([
      [{ ...link, status: "paid", notifiedAt: null }],
      [
        { provider: "whatsapp", externalId: "phone", lastInboundAt: new Date(0) },
        { provider: "telegram", externalId: "chat" },
      ],
    ]);
    const whatsapp = vi.fn(),
      telegram = vi.fn();
    await new PaymentNotificationService(
      db,
      { createOutboundMessage: telegram } as unknown as TelegramClient,
      { createOutboundMessage: whatsapp } as unknown as WhatsAppClient,
    ).createNotification("ref");
    expect(whatsapp).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "template", externalId: "phone" }),
    );
    expect(telegram).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "text", externalId: "chat" }),
    );
    expect(updates).toHaveBeenCalledWith({ notifiedAt: expect.any(Date) });
  });
});
