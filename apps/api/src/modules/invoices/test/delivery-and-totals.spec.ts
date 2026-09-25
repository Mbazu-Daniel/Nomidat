import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createDbStub } from "../../../common/db/test/db.stub";
import { InvoiceDeliveryService } from "../invoice-delivery.service";
import { InvoicesService } from "../invoices.service";
import type { ApiEnv } from "../../../common/config/env";
import type { EmailClient } from "@nomidat/email";
import type { TelegramClient } from "../../telegram/telegram.client";
import type { WhatsAppClient } from "../../whatsapp/whatsapp.client";
function delivery(rows: unknown[][] = []) {
  const { db } = createDbStub(rows);
  const send = vi.fn(),
    outbound = vi.fn();
  const service = new InvoiceDeliveryService(
    db,
    { BETTER_AUTH_SECRET: "test-only", BETTER_AUTH_URL: "https://shop.test" } as ApiEnv,
    { send } as unknown as EmailClient,
    {
      getInvoice: vi.fn().mockResolvedValue({ invoiceNumber: "INV-1" }),
    } as unknown as InvoicesService,
    { createOutboundMessage: outbound } as unknown as TelegramClient,
    { createOutboundMessage: outbound } as unknown as WhatsAppClient,
  );
  vi.spyOn(service, "getPdf").mockResolvedValue(Buffer.from("pdf-test"));
  return { service, send, outbound };
}
describe("invoice safeguards", () => {
  it("attaches the generated invoice only to the requested email", async () => {
    const { service, send } = delivery();
    await service.createDelivery("shop", "invoice", {
      channel: "email",
      email: "ada@example.test",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { address: "ada@example.test" },
        attachments: [
          {
            name: "INV-1.pdf",
            mimeType: "application/pdf",
            content: Buffer.from("pdf-test").toString("base64"),
          },
        ],
      }),
    );
    await expect(service.createDelivery("shop", "invoice", { channel: "email" })).rejects.toThrow(
      "recipient email",
    );
  });
  it("requires a linked chat and enforces the WhatsApp reply window", async () => {
    const { service, outbound } = delivery([
      [],
      [{ externalId: "phone", lastInboundAt: new Date(0) }],
      [{ externalId: "chat", lastInboundAt: new Date() }],
    ]);
    await expect(
      service.createDelivery("shop", "invoice", {
        channel: "telegram",
        channelIdentityId: "missing",
      }),
    ).rejects.toThrow("not found");
    await expect(
      service.createDelivery("shop", "invoice", {
        channel: "whatsapp",
        channelIdentityId: "phone",
      }),
    ).rejects.toThrow("24-hour");
    expect(outbound).not.toHaveBeenCalled();
    await service.createDelivery("shop", "invoice", {
      channel: "telegram",
      channelIdentityId: "chat",
    });
    expect(outbound).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "document",
        externalId: "chat",
        documentFilename: "INV-1.pdf",
        documentUrl: expect.stringContaining("token="),
      }),
    );
  });
  it("rejects tampered or expired signed document links", async () => {
    const { service } = delivery();
    const expires = Date.now() + 60000;
    const token = createHmac("sha256", "test-only")
      .update(`invoice:shop:invoice:${expires}`)
      .digest("hex");
    await expect(service.getSignedPdf("shop", "invoice", expires, token)).resolves.toEqual(
      Buffer.from("pdf-test"),
    );
    expect(() => service.getSignedPdf("other", "invoice", expires, token)).toThrow(
      "invalid or expired",
    );
    expect(() => service.getSignedPdf("shop", "invoice", 0, token)).toThrow("invalid or expired");
  });
  it("rejects invalid invoice totals before opening a transaction", async () => {
    const { db, mock } = createDbStub();
    const service = new InvoicesService(db);
    await expect(service.createInvoice("shop", { items: [] })).rejects.toThrow("At least one");
    await expect(
      service.createInvoice("shop", {
        items: [{ description: "Rice", quantity: 1, unitPriceKobo: 0 }],
      }),
    ).rejects.toThrow("greater than zero");
    await expect(
      service.createInvoice("shop", {
        items: [{ description: "Rice", quantity: 100000, unitPriceKobo: 100000000 }],
      }),
    ).rejects.toThrow("supported amount");
    await expect(
      service.createInvoice("shop", {
        items: [{ description: "Rice", quantity: 1, unitPriceKobo: 100 }],
        discountKobo: 101,
        taxKobo: 100,
      }),
    ).rejects.toThrow("Discount cannot exceed");
    expect(mock.transaction).not.toHaveBeenCalled();
  });
});
