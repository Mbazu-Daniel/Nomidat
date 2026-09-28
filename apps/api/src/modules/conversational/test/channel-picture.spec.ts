import { describe, expect, it, vi } from "vitest";
import { ChannelPictureReader } from "../channel-picture-reader";
import { ChannelProvider } from "../../channel/types";
import type { PictureImportService } from "../../picture-import/picture-import.service";
import type { InboundMessage } from "../../channel/types";
const inbound: InboundMessage = {
  provider: ChannelProvider.Telegram,
  externalId: "test",
  kind: "image",
  text: "record this expense",
  mediaUrl: "file",
  mediaMimeType: "image/png",
  receivedAt: new Date(),
};
const adapter = {
  provider: ChannelProvider.Telegram,
  createOutboundMessage: vi.fn(),
  getInboundMedia: vi.fn().mockResolvedValue({ data: new Uint8Array([1]), mimeType: "image/png" }),
};
describe("channel photo review", () => {
  it("prepares extracted expense facts without executing a business write", async () => {
    const extract = vi.fn().mockResolvedValue({
      expense: {
        description: "Delivery",
        amountNaira: 500,
        date: null,
        category: null,
        paymentMethod: "transfer",
      },
      warnings: [],
    });
    const result = await new ChannelPictureReader({
      extract,
    } as unknown as PictureImportService).read(inbound, adapter);
    expect(result.action).toMatchObject({
      intent: "record_expense",
      amountNaira: 500,
      paymentMethod: "transfer",
    });
    expect(extract).toHaveBeenCalledWith(
      "expenses",
      expect.objectContaining({ mimetype: "image/png" }),
    );
    expect(adapter.createOutboundMessage).not.toHaveBeenCalled();
  });
  it("asks for a purpose before downloading an uncaptioned photo", async () => {
    const getInboundMedia = vi.fn();
    await expect(
      new ChannelPictureReader({} as PictureImportService).read(
        { ...inbound, text: undefined },
        { ...adapter, getInboundMedia },
      ),
    ).rejects.toThrow("caption");
    expect(getInboundMedia).not.toHaveBeenCalled();
  });
  it("does not invent missing stock or selling price for a product photo", async () => {
    const extract = vi.fn().mockResolvedValue({
      items: [{ name: "Cement", quantity: null, unitPriceNaira: null, unit: "bags" }],
      warnings: [],
    });
    const result = await new ChannelPictureReader({
      extract,
    } as unknown as PictureImportService).read({ ...inbound, text: "inventory" }, adapter);
    expect(result.action.stockQuantity).toBeUndefined();
    expect(result.action.unitPriceNaira).toBeUndefined();
  });
});

it("retains extracted invoice amounts and customer for confirmation", async () => {
  const extract = vi
    .fn()
    .mockResolvedValue({
      items: [{ name: "Rice", quantity: 2, unitPriceNaira: 100, unit: "bags" }],
      invoice: {
        customerName: "Ada",
        dueDate: "2026-10-01",
        taxNaira: 5,
        discountNaira: 2,
        notes: "Delivery",
      },
      warnings: [],
    });
  const reader = new ChannelPictureReader({ extract } as unknown as PictureImportService);
  const result = await reader.read({ ...inbound, text: "invoice" }, adapter);
  expect(result.action).toMatchObject({
    intent: "create_invoice",
    customerName: "Ada",
    date: "2026-10-01",
    taxNaira: 5,
    discountNaira: 2,
    items: [{ description: "Rice", quantity: 2, unitPriceNaira: 100 }],
  });
});
